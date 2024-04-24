import assert from "node:assert";
import { inspect } from "node:util";

import type { ESTree } from "meriyah";

import type * as AppMap from "../AppMap";
import { getTime } from "../util/getTime";
import { fixReturnEventsIfPromiseResult, getActiveRecordings } from "../recorder";
import { FunctionInfo } from "../registry";
import config from "../config";
import { setCustomInspect } from "../parameter";

const patchedModules = new WeakSet<object>();
const sqlHookAttachedPrismaClientInstances = new WeakSet<object>();

export default function prismaHook(mod: object, id?: string) {
  if (patchedModules.has(mod)) return mod;
  patchedModules.add(mod);

  assert("PrismaClient" in mod && typeof mod.PrismaClient === "function");
  // (1) Prisma Queries: We proxy prismaClient._request method in order to record
  // prisma queries (not sqls) as appmap function call events.
  // (2) SQL Queries: We have to change config parameters (logLevel, logQueries)
  // and register a prismaClient.$on("query") handler to record sql queries.
  // We have to do it by proxying mod.PrismaClient here, since it turned out that
  // it's too late to do it inside the first invocation of the _request method,
  // because $on is (becomes?) undefined in extended prisma clients.
  // https://www.prisma.io/docs/orm/reference/prisma-client-reference#remarks-37

  // Normally, we "Cannot assign to 'PrismaClient' because it is a read-only property."
  const prismaClientProxy: unknown = new Proxy(mod.PrismaClient, {
    construct(target, argArray, newTarget): object {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
      const result = Reflect.construct(target, argArray, newTarget);
      assert(typeof result === "object");

      // This check will prevent this edge case. Not sure if this can happen
      // with extended/customized Prisma clients, however.
      //   class A { ... };
      //   const AP = new Proxy(A, construct( ... ));
      //   class B extends AP { ... };
      //   const BP = new Proxy(B, construct( ... ));
      //   const client = new BP();
      // Without this check attachSqlHook will be called twice for the new
      // client object in this example.
      if (!sqlHookAttachedPrismaClientInstances.has(result as object)) {
        sqlHookAttachedPrismaClientInstances.add(result as object);
        attachSqlHook(result);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
  return mod;
}

prismaHook.applicable = function (id: string) {
  return config.prismaClientModuleIds.includes(id);
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

function createPrismaClientMethodProxy<T extends (...args: unknown[]) => unknown>(
  prismaClientMethod: T,
  moduleId: string,
) {
  return new Proxy(prismaClientMethod, {
    apply(target, thisArg: unknown, argArray: Parameters<T>) {
      // Report Prisma query as a function call, if suitable
      let prismaCalls: AppMap.FunctionCallEvent[] | undefined;
      const recordings = getActiveRecordings();
      if (argArray?.length > 0) {
        const requestParams = argArray[0] as PrismaRequestParams;
        if (requestParams.action && requestParams.model) {
          const action = requestParams.action;
          const model = requestParams.model;
          const argsArg = [setCustomInspect(requestParams.args, argsCustomInspect)];
          prismaCalls = recordings.map((recording) =>
            recording.functionCall(getFunctionInfo(model, action, moduleId), model, argsArg),
          );
        }
      }

      if (prismaCalls != undefined) {
        const startTime = getTime();
        const calls = prismaCalls;
        try {
          const result = target.apply(thisArg, argArray);

          const elapsed = getTime() - startTime;
          const returnEvents = recordings.map((recording, idx) =>
            recording.functionReturn(calls[idx].id, result, elapsed),
          );
          return fixReturnEventsIfPromiseResult(recordings, result, returnEvents, calls, startTime);
        } catch (exn: unknown) {
          const elapsed = getTime() - startTime;
          recordings.forEach((recording, idx) =>
            recording.functionException(calls[idx].id, exn, elapsed),
          );
          throw exn;
        }
      }

      return target.apply(thisArg, argArray);
    },
  });
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
      "logLevel" in thisArg._engine.config &&
      "logQueries" in thisArg._engine.config &&
      "activeProvider" in thisArg._engine.config &&
      typeof thisArg._engine.config.activeProvider == "string",
  );

  const dbType = thisArg._engine.config.activeProvider;
  thisArg._engine.config.logLevel = "query";
  thisArg._engine.config.logQueries = true;
  assert("$on" in thisArg && typeof thisArg.$on === "function");
  thisArg.$on("query", (queryEvent: QueryEvent) => {
    const recordings = getActiveRecordings();
    const callEvents = recordings.map((recording) => recording.sqlQuery(dbType, queryEvent.query));
    const elapsedSec = queryEvent.duration / 1000.0;
    recordings.forEach((recording, idx) =>
      recording.functionReturn(callEvents[idx].id, undefined, elapsedSec),
    );
  });
}
