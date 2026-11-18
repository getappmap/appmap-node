import assert from "node:assert";
import { AsyncLocalStorage } from "node:async_hooks";
import { inspect } from "node:util";

import type { ESTree } from "meriyah";

import type * as AppMap from "../AppMap";
import { getTime } from "../util/getTime";
import { getActiveRecordings } from "../recorder";
import { FunctionInfo } from "../registry";
import config from "../config";
import { setCustomInspect } from "../parameter";
import { isPromise } from "node:util/types";
import Recording, { EventBuffer } from "../Recording";

const patchedModules = new WeakSet<object>();
const sqlHookAttachedPrismaClientInstances = new WeakSet<object>();

export default function prismaHook(mod: object, id?: string) {
  if (patchedModules.has(mod)) return mod;
  patchedModules.add(mod);

  assert("PrismaClient" in mod && typeof mod.PrismaClient === "function");
  // (1) Prisma Queries: We proxy prismaClient._request method in order to record
  // prisma queries (not sqls) as appmap function call events.
  // (2) SQL Queries: We have to turn on query logging (the log option) and
  // register a prismaClient.$on("query") handler to record sql queries.
  // We have to do it by proxying mod.PrismaClient here, since it turned out that
  // it's too late to do it inside the first invocation of the _request method,
  // because $on is (becomes?) undefined in extended prisma clients.
  // https://www.prisma.io/docs/orm/reference/prisma-client-reference#remarks-37

  // Normally, we "Cannot assign to 'PrismaClient' because it is a read-only property."
  const prismaClientProxy: unknown = new Proxy(mod.PrismaClient, {
    construct(target, argArray: unknown[], newTarget): object {
      const owner: AdapterOwner = {};
      const result: unknown = Reflect.construct(target, withOptions(argArray, owner), newTarget);
      assert(typeof result === "object" && result);
      if ("_engine" in result && typeof result._engine == "object" && result._engine)
        owner.engine = result._engine;

      // This check will prevent this edge case. Not sure if this can happen
      // with extended/customized Prisma clients, however.
      //   class A { ... };
      //   const AP = new Proxy(A, construct( ... ));
      //   class B extends AP { ... };
      //   const BP = new Proxy(B, construct( ... ));
      //   const client = new BP();
      // Without this check attachSqlHook will be called twice for the new
      // client object in this example.
      if (!sqlHookAttachedPrismaClientInstances.has(result)) {
        sqlHookAttachedPrismaClientInstances.add(result);
        attachSqlHook(result);
      }

      return result;
    },
  });
  Object.defineProperty(mod, "PrismaClient", {
    value: prismaClientProxy,
    enumerable: false,
    writable: true,
  });

  // Imported PrismaClient type does not have _request method in type definition.
  // But we have it in runtime.
  const PC = mod.PrismaClient;
  assert("prototype" in PC && typeof PC.prototype === "object");
  const proto = PC.prototype as object;
  assert(proto != null && typeof proto === "object");
  assert("_request" in proto);
  proto._request = createPrismaClientMethodProxy(
    proto._request as (...args: unknown[]) => unknown,
    id ?? "@prisma/client",
  );
  // Interactive transactions run their BEGIN and COMMIT outside of any request.
  if ("_transactionWithCallback" in proto && typeof proto._transactionWithCallback == "function")
    proto._transactionWithCallback = createTransactionProxy(
      proto._transactionWithCallback as (...args: unknown[]) => unknown,
    );
  return mod;
}

prismaHook.applicable = function (id: string) {
  return config().prismaClientModuleIds.includes(id);
};

// https://github.com/prisma/prisma/blob/095cba1a1b79d0d950246b07c9fb48d22fd7f229/packages/client/src/runtime/getPrismaClient.ts#L181
interface QueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

interface PrismaRequestParamsArgs {
  data?: unknown;
  include?: unknown;
  where?: unknown;
}

interface PrismaRequestParams {
  action?: string;
  model?: string;
  args?: PrismaRequestParamsArgs;
  transaction?: unknown;
}

const functionInfos = new Map<string, FunctionInfo>();

let functionCount = 0;
function getFunctionInfo(model: string, action: string, moduleId: string) {
  const key = model + "." + action;

  if (!functionInfos.has(key)) {
    const params = [{ type: "Identifier", name: "args" } as ESTree.Identifier];
    const info: FunctionInfo = {
      async: true,
      generator: false,
      id: action,
      params: params,
      location: { path: `${moduleId}/${model}`, lineno: ++functionCount },
      klassOrFile: model,
      static: true,
    };
    functionInfos.set(key, info);
  }

  return functionInfos.get(key)!;
}

// Prisma model query args argument typically has more
// than 2 levels deep structure.
const argsCustomInspect = (v: unknown) => inspect(v, { customInspect: true, depth: 10 });

// Turns on query logging, and tracks the calls made through the driver adapter.
function withOptions(argArray: unknown[], owner: AdapterOwner): unknown[] {
  const [options, ...rest] = argArray;
  if (options != undefined && typeof options !== "object") return argArray;
  const { log, adapter } = (options ?? {}) as { log?: unknown; adapter?: unknown };
  const queryEvents = { emit: "event", level: "query" };
  return [
    {
      ...options,
      log: Array.isArray(log) ? [...(log as unknown[]), queryEvents] : [queryEvents],
      ...(adapter && typeof adapter == "object" ? { adapter: trackAdapter(adapter, owner) } : {}),
    },
    ...rest,
  ];
}

// With Prisma 7+ (or the driverAdapters preview feature) queries go through a
// JavaScript driver adapter. If we hook its driver (eg. pg), the hook records them
// already, with more detail (eg. errors), so the query events of the client are
// ignored once the hook has recorded a query in a call made through the adapter.
// Clients are told apart by their engine, which extended clients share with the one
// they extend.
interface AdapterOwner {
  engine?: object;
}
const adapterStorage = new AsyncLocalStorage<AdapterOwner>();
const enginesWithHookedDriver = new WeakSet<object>();
Recording.onSqlQuery = () => {
  const engine = adapterStorage.getStore()?.engine;
  if (engine) enginesWithHookedDriver.add(engine);
};

// The methods of an adapter (or its factory) which return the objects which make
// the queries: the adapter, a transaction or (in Prisma 5) a transaction context.
const adapterMakers = ["connect", "connectToShadowDb", "startTransaction", "transactionContext"];

// Runs the methods of the adapter in the context of its owner.
function trackAdapter(adapter: object, owner: AdapterOwner): object {
  const track = (value: unknown) =>
    value && typeof value == "object" ? trackAdapter(value, owner) : value;
  return new Proxy(adapter, {
    get(target, key) {
      // Read with the target as the receiver, and call the methods on it too, so
      // that they can use private fields.
      const value = Reflect.get(target, key, target) as unknown;
      if (typeof value != "function") return value;
      return (...args: unknown[]): unknown => {
        const result = adapterStorage.run(owner, () => value.apply(target, args) as unknown);
        if (!adapterMakers.includes(String(key))) return result;
        return isPromise(result) ? result.then(track) : track(result);
      };
    },
  });
}

// The Prisma requests (and interactive transactions) in progress. SQL query events
// are recorded in the context of the request which made the query. Prisma 7+ runs
// queries in JavaScript and emits the events in that context. Earlier versions
// (with the Rust query engine) emit them out of any context and don't tell which
// request a query belongs to. Then a query is placed in the request in progress, or
// if there are several, in the closest context enclosing them all. Those events can
// also come after the request is done, so requests are kept here until the next turn
// of the event loop. That's a best guess: an event can come later still, once
// another request has started, and then it's placed in that one.
interface PendingRequest {
  context: EventBuffer | undefined;
  engine: unknown;
  settled: boolean;
  // whether Prisma may run it in a batch with others, see queryContext()
  batchable: boolean;
}
const pendingRequests = new Set<PendingRequest>();
const requestStorage = new AsyncLocalStorage<PendingRequest>();

// Runs a request in a context of its own, so that its SQL queries are placed in it.
function runRequest(
  thisArg: unknown,
  { batchable }: { batchable: boolean },
  fun: () => unknown,
): { result: unknown; complete: () => void } {
  const engine = (thisArg as { _engine?: unknown } | undefined)?._engine;
  const request: PendingRequest = {
    context: undefined,
    engine,
    settled: false,
    batchable,
  };
  // Requests made before a recording starts are tracked too, so that their queries
  // aren't attributed to the ones made after.
  const run = () => requestStorage.run(request, fun);
  const { result, complete } =
    getActiveRecordings().length > 0
      ? Recording.fork(() => {
          request.context = Recording.getContext();
          return run();
        })
      : { result: run(), complete: () => undefined };
  assert(isPromise(result));
  pendingRequests.add(request);
  const settle = () => {
    request.settled = true;
    complete();
    setImmediate(() => pendingRequests.delete(request));
  };
  // Settle with result.then(cb, cb) rather than result.finally(cb): the latter
  // returns a new promise that nothing awaits, so a rejected query the application
  // caught (a P2002 unique violation, for example) would surface as an unhandled
  // rejection.
  result.then(settle, settle);
  return { result, complete };
}

function createPrismaClientMethodProxy<T extends (...args: unknown[]) => unknown>(
  prismaClientMethod: T,
  moduleId: string,
) {
  return new Proxy(prismaClientMethod, {
    apply(target, thisArg: unknown, argArray: Parameters<T>) {
      const recordings = getActiveRecordings();

      // Report Prisma query as a function call, if suitable. Raw queries aren't
      // recorded as calls, but still run in a context of their own.
      let calls: AppMap.FunctionCallEvent[] = [];
      const requestParams = argArray?.[0] as PrismaRequestParams | undefined;
      if (requestParams?.action && requestParams.model) {
        const { action, model } = requestParams;
        const argsArg = [setCustomInspect(requestParams.args, argsCustomInspect)];
        calls = recordings.map((recording) =>
          recording.functionCall(getFunctionInfo(model, action, moduleId), model, argsArg),
        );
      }

      // Prisma batches findUnique calls made at the same time, as well as the
      // requests in a transaction.
      const batchable =
        requestParams?.transaction != undefined ||
        requestParams?.action == "findUnique" ||
        requestParams?.action == "findUniqueOrThrow";
      const startTime = getTime();
      try {
        const { result } = runRequest(thisArg, { batchable }, () =>
          target.apply(thisArg, argArray),
        );
        // functionReturn attaches its own handlers to the promise and turns the
        // return event into an exception event when the query rejects.
        recordings.forEach((recording, idx) => {
          if (calls[idx]) recording.functionReturn(calls[idx].id, result, startTime);
        });
        return result;
      } catch (exn: unknown) {
        recordings.forEach((recording, idx) => {
          if (calls[idx]) recording.functionException(calls[idx].id, exn, startTime);
        });
        throw exn;
      }
    },
  });
}

function createTransactionProxy<T extends (...args: unknown[]) => unknown>(method: T) {
  return new Proxy(method, {
    apply(target, thisArg: unknown, argArray: Parameters<T>) {
      return runRequest(thisArg, { batchable: false }, () => target.apply(thisArg, argArray))
        .result;
    },
  });
}

// The closest context enclosing all of the given ones (undefined being the root).
function enclosingContext(contexts: (EventBuffer | undefined)[]): EventBuffer | undefined {
  const [first, ...rest] = contexts;
  // the ancestors of the first one, closest first
  const ancestors = new Map<EventBuffer, number>();
  for (let c = first; c; c = c.parent) ancestors.set(c, ancestors.size);
  let closest = 0;
  for (const context of rest) {
    let c = context;
    while (c && !ancestors.has(c)) c = c.parent;
    if (!c) return undefined;
    closest = Math.max(closest, ancestors.get(c)!);
  }
  return [...ancestors.keys()][closest];
}

// The requests in progress which can be making a query. One waiting for another
// made inside it (eg. a transaction for the requests in it) is not.
function candidates(requests: PendingRequest[]): PendingRequest[] {
  const waiting = new Set<EventBuffer>();
  for (const { context } of requests) for (let c = context?.parent; c; c = c.parent) waiting.add(c);
  return requests.filter(({ context }) => !context || !waiting.has(context));
}

// The engines which emit query events in the context of the requests, see
// queryContext(). Clients are told apart by their engine, which extended clients
// share with the one they extend.
const enginesKeepingContext = new WeakSet<object>();

function queryContext(engine: object): EventBuffer | undefined {
  const pending = [...pendingRequests].filter((request) => request.engine === engine);
  const request = requestStorage.getStore();
  if (request) {
    enginesKeepingContext.add(engine);
    // Prisma runs the requests in a batch in the context of the first one, so a
    // query in it could belong to any of the batchable requests in progress. (When
    // a driver hook records the queries instead, they're placed in the first one.)
    if (!request.batchable) return Recording.getContext();
    const batch = pending.filter(({ batchable, settled }) => batchable && !settled);
    return enclosingContext(candidates(batch).map(({ context }) => context));
  }
  // Then the ones which come outside of any request (eg. the COMMIT of an
  // interactive transaction on Prisma 7) are where they belong too.
  if (enginesKeepingContext.has(engine) || pending.length == 0) return Recording.getContext();
  return enclosingContext(candidates(pending).map(({ context }) => context));
}

function attachSqlHook(thisArg: unknown) {
  assert(
    thisArg != null &&
      typeof thisArg === "object" &&
      "_engine" in thisArg &&
      thisArg._engine != null &&
      typeof thisArg._engine === "object" &&
      "config" in thisArg._engine &&
      thisArg._engine.config != null &&
      typeof thisArg._engine.config === "object" &&
      "activeProvider" in thisArg._engine.config &&
      typeof thisArg._engine.config.activeProvider == "string",
  );

  const dbType = thisArg._engine.config.activeProvider;
  const engine = thisArg._engine;
  assert("$on" in thisArg && typeof thisArg.$on === "function");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  thisArg.$on("query", (queryEvent: QueryEvent) => {
    if (enginesWithHookedDriver.has(engine)) return;
    const recordings = getActiveRecordings();

    Recording.run(queryContext(engine), () => {
      const callEvents = recordings.map((recording) =>
        recording.sqlQuery(dbType, queryEvent.query),
      );
      const elapsedSec = queryEvent.duration / 1000.0;
      // Give a startTime so that functionReturn calculates same elapsedSec
      const startTime = getTime() - elapsedSec;
      recordings.forEach((recording, idx) =>
        recording.functionReturn(callEvents[idx].id, undefined, startTime),
      );
    });
  });
}
