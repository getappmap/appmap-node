import { getActiveRecordings, isActive } from "../recorder";
import { getTime } from "../util/getTime";

// https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
//
// better-sqlite3 exports its Database class. Statement is not exported, so its
// prototype is picked up from the first statement that `prepare` returns and
// patched once. Every method is synchronous, which keeps the recording simple:
// a sql_query call event before the call and a return (or exception) event
// right after it, on the same async context.

type AnyFunction = (this: unknown, ...args: unknown[]) => unknown;
type SqlOf = (thisArg: unknown, args: unknown[]) => string | undefined;

export default function betterSqlite3Hook(mod: unknown) {
  if (typeof mod !== "function" || typeof mod.prototype !== "object" || mod.prototype === null)
    return mod;

  const proto = mod.prototype as Record<string, unknown>;

  if (typeof proto.exec === "function")
    proto.exec = createRecordingProxy(proto.exec as AnyFunction, (_, args) => stringArg(args[0]));

  // pragma() does not go through prepare(), so it needs its own hook.
  if (typeof proto.pragma === "function")
    proto.pragma = createRecordingProxy(proto.pragma as AnyFunction, (_, args) => {
      const pragma = stringArg(args[0]);
      return pragma === undefined ? undefined : `PRAGMA ${pragma}`;
    });

  if (typeof proto.prepare === "function")
    proto.prepare = createPrepareProxy(proto.prepare as AnyFunction);

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
      const finish = (exn?: unknown) => {
        if (finished) return;
        finished = true;
        recordings.forEach((recording, idx) => {
          if (!isActive(recording)) return;
          if (exn === undefined) recording.functionReturn(callEvents[idx].id, undefined, startTime);
          else recording.functionException(callEvents[idx].id, exn, startTime);
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
            finish(exn ?? new Error("iteration failed"));
            throw exn;
          }
        },
        return(...args: unknown[]) {
          try {
            return native.return ? native.return(...args) : { done: true, value: undefined };
          } finally {
            finish();
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
