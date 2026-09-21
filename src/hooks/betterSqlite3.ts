import { getActiveRecordings, isActive } from "../recorder";
import { getTime } from "../util/getTime";

// https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
//
// better-sqlite3 exports its Database class. Statement is not exported, so its
// prototype is picked up from the first statement that `prepare` returns and
// patched once; methods that compile statements of their own prime that patch
// before they run. Every method is synchronous, which keeps recording simple:
// a sql_query call event before the call and a return (or exception) event
// right after it, on the same async context.

type AnyFunction = (this: unknown, ...args: unknown[]) => unknown;
type SqlOf = (thisArg: unknown, args: unknown[]) => string | undefined;

const patchedModules = new WeakSet<object>();

export default function betterSqlite3Hook(mod: unknown) {
  if (typeof mod !== "function" || typeof mod.prototype !== "object" || mod.prototype === null)
    return mod;

  // The require hook runs for every require of the module, cache hits
  // included, so patching has to be idempotent: wrapping a wrapper would
  // record one event per layer.
  if (patchedModules.has(mod)) return mod;
  patchedModules.add(mod);

  const proto = mod.prototype as Record<string, unknown>;

  if (typeof proto.exec === "function")
    proto.exec = createRecordingProxy(proto.exec as AnyFunction, (_, args) => stringArg(args[0]));

  if (typeof proto.prepare === "function") {
    const prepare = proto.prepare as AnyFunction;
    proto.prepare = createPrepareProxy(prepare);

    // pragma() and transaction() run statements that never pass through
    // prepare(): pragma() compiles its own, and the transaction controller
    // compiles BEGIN, COMMIT and ROLLBACK on the native database handle. Both
    // are recorded by the Statement patch, but neither can install it, and
    // BEGIN has already run by the time a transaction callback prepares
    // anything. Prime the patch before either of them runs instead.
    for (const method of ["pragma", "transaction"])
      if (typeof proto[method] === "function")
        proto[method] = createPrimingProxy(proto[method] as AnyFunction, prepare);
  }

  return mod;
}

betterSqlite3Hook.applicable = function (id: string) {
  return id === "better-sqlite3";
};

const patchedStatementPrototypes = new WeakSet<object>();

function createPrepareProxy(prepare: AnyFunction) {
  return new Proxy(prepare, {
    apply(target, thisArg, argArray: unknown[]) {
      const statement: unknown = Reflect.apply(target, thisArg, argArray);
      if (statement !== null && typeof statement === "object") patchStatementPrototype(statement);
      return statement;
    },
  });
}

const primedPrepares = new WeakSet<object>();

// Runs `fn` with the Statement prototype already patched, so that statements
// `fn` compiles behind our back are recorded too. The prototype is shared by
// every statement of a module, so a single throwaway statement is enough to
// get hold of it, once.
function createPrimingProxy(fn: AnyFunction, prepare: AnyFunction) {
  return new Proxy(fn, {
    apply(target, thisArg, argArray: unknown[]) {
      primeStatementPrototype(prepare, thisArg);
      return Reflect.apply(target, thisArg, argArray);
    },
  });
}

function primeStatementPrototype(prepare: AnyFunction, database: unknown) {
  if (primedPrepares.has(prepare)) return;
  try {
    const statement: unknown = Reflect.apply(prepare, database, ["SELECT 1"]);
    if (statement === null || typeof statement !== "object") return;
    patchStatementPrototype(statement);
    primedPrepares.add(prepare);
  } catch {
    // A connection that cannot compile even this is in no state to run
    // anything else either, and it may not be the only connection around.
    // Leave the prototype to the application's own prepare() call and try
    // again on the next one.
  }
}

function patchStatementPrototype(statement: object) {
  const proto: unknown = Object.getPrototypeOf(statement);
  if (proto === null || typeof proto !== "object" || patchedStatementPrototypes.has(proto)) return;
  patchedStatementPrototypes.add(proto);

  const p = proto as Record<string, unknown>;
  const sqlOfStatement: SqlOf = (thisArg) => statementSource(thisArg);
  for (const method of ["run", "get", "all"])
    if (typeof p[method] === "function")
      p[method] = createRecordingProxy(p[method] as AnyFunction, sqlOfStatement);
  if (typeof p.iterate === "function")
    p.iterate = createIterateProxy(p.iterate as AnyFunction, sqlOfStatement);
}

function stringArg(arg: unknown): string | undefined {
  return typeof arg === "string" ? arg : undefined;
}

function statementSource(statement: unknown): string | undefined {
  if (statement !== null && typeof statement === "object" && "source" in statement)
    return stringArg(statement.source);
  return undefined;
}

// Emits a sql_query call event, runs the method, and emits the return or
// exception event as soon as it comes back.
function createRecordingProxy<T extends AnyFunction>(proxyTarget: T, sqlOf: SqlOf) {
  return new Proxy(proxyTarget, {
    apply(target, thisArg, argArray: unknown[]) {
      const sql = sqlOf(thisArg, argArray);
      // No SQL to report (for example, pragma() called with a non-string):
      // short circuit to the original function and let it handle the arguments.
      if (sql === undefined) return Reflect.apply(target, thisArg, argArray);

      const recordings = getActiveRecordings();
      const callEvents = recordings.map((recording) => recording.sqlQuery("sqlite", sql));
      const startTime = getTime();
      try {
        const result: unknown = Reflect.apply(target, thisArg, argArray);
        recordings.forEach(
          (recording, idx) =>
            isActive(recording) &&
            recording.functionReturn(callEvents[idx].id, undefined, startTime),
        );
        return result;
      } catch (exn: unknown) {
        recordings.forEach(
          (recording, idx) =>
            isActive(recording) && recording.functionException(callEvents[idx].id, exn, startTime),
        );
        throw exn;
      }
    },
  });
}

interface IteratorLike {
  next(...args: unknown[]): IteratorResult<unknown>;
  return?(...args: unknown[]): IteratorResult<unknown>;
}

function isIteratorLike(obj: unknown): obj is IteratorLike {
  return obj !== null && typeof obj === "object" && "next" in obj && typeof obj.next === "function";
}

// iterate() hands rows out lazily, so the query is only finished when the
// iterator is exhausted, returned early (a `break` in a for..of), or throws.
// The return event is emitted at that point. The native iterator's methods
// must be called on the native object, not on the proxy, so they are bound
// explicitly rather than reached through the proxy's receiver.
function createIterateProxy(iterate: AnyFunction, sqlOf: SqlOf) {
  return new Proxy(iterate, {
    apply(target, thisArg, argArray: unknown[]) {
      const sql = sqlOf(thisArg, argArray);
      if (sql === undefined) return Reflect.apply(target, thisArg, argArray);

      const recordings = getActiveRecordings();
      const callEvents = recordings.map((recording) => recording.sqlQuery("sqlite", sql));
      const startTime = getTime();

      let iterator: unknown;
      try {
        iterator = Reflect.apply(target, thisArg, argArray);
      } catch (exn: unknown) {
        recordings.forEach(
          (recording, idx) =>
            isActive(recording) && recording.functionException(callEvents[idx].id, exn, startTime),
        );
        throw exn;
      }
      if (!isIteratorLike(iterator)) {
        recordings.forEach(
          (recording, idx) =>
            isActive(recording) &&
            recording.functionReturn(callEvents[idx].id, undefined, startTime),
        );
        return iterator;
      }

      let finished = false;
      // The failure is passed boxed so that a thrown undefined still finishes
      // the query as an exception rather than as a successful return.
      const finish = (failure?: { exception: unknown }) => {
        if (finished) return;
        finished = true;
        recordings.forEach((recording, idx) => {
          if (!isActive(recording)) return;
          if (failure)
            recording.functionException(callEvents[idx].id, failure.exception, startTime);
          else recording.functionReturn(callEvents[idx].id, undefined, startTime);
        });
      };

      const native = iterator;
      const proxy: IteratorLike & Iterable<unknown> = {
        next(...args: unknown[]) {
          try {
            const result = native.next(...args);
            if (result.done) finish();
            return result;
          } catch (exn: unknown) {
            finish({ exception: exn });
            throw exn;
          }
        },
        return(...args: unknown[]) {
          try {
            const result = native.return
              ? native.return(...args)
              : { done: true, value: undefined };
            finish();
            return result;
          } catch (exn: unknown) {
            // Cleaning up can fail too (better-sqlite3 refuses to release an
            // iterator while the connection is busy). The query is over either
            // way, but it did not end well.
            finish({ exception: exn });
            throw exn;
          }
        },
        [Symbol.iterator]() {
          return this as Iterator<unknown>;
        },
      };
      return proxy;
    },
  });
}
