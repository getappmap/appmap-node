import assert from "node:assert";

import { ESTree } from "meriyah";
import type prisma from "@prisma/client";

import type AppMap from "../AppMap";
import { getTime } from "../util/getTime";
import { fixReturnEventIfPromiseResult, recording } from "../recorder";
import { FunctionInfo } from "../registry";
import config from "../config";

export default function prismaHook(mod: typeof prisma, id?: string) {
  // Imported PrismaClient type does not have _request method in type definition.
  // But we have it in runtime.
  console.log("MOD", mod);
  assert(mod.PrismaClient != null);
  const PC = mod.PrismaClient as { prototype: unknown };
  const proto = PC.prototype;
  assert(proto != null && typeof proto === "object");
  assert("_request" in proto);
  proto._request = createProxy(
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

let hookAttached = false;

const functionInfos = new Map<string, FunctionInfo>();

let functionCount = 0;
function getFunctionInfo(model: string, action: string, moduleId: string) {
  const key = model + "." + action;

  if (!functionInfos.has(key)) {
    const params = ["data", "include", "where"].map((k) => {
      return { type: "Identifier", name: k } as ESTree.Identifier;
    });
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

function createProxy<T extends (...args: unknown[]) => unknown>(
  prismaClientMethod: T,
  moduleId: string,
) {
  return new Proxy(prismaClientMethod, {
    apply(target, thisArg: unknown, argArray: Parameters<T>) {
      if (!hookAttached) {
        hookAttached = true;
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
          const call = recording.sqlQuery(dbType, queryEvent.query);
          const elapsedSec = queryEvent.duration / 1000.0;
          recording.functionReturn(call.id, undefined, elapsedSec);
        });
      }

      // Report Prisma query as a function call, if suitable
      let prismaCall: AppMap.FunctionCallEvent | undefined;
      if (argArray?.length > 0) {
        const requestParams = argArray[0] as PrismaRequestParams;

        if (requestParams.action && requestParams.model) {
          prismaCall = recording.functionCall(
            getFunctionInfo(requestParams.model, requestParams.action, moduleId),
            requestParams.model,
            [requestParams.args?.data, requestParams.args?.include, requestParams.args?.where],
          );
        }
      }

      if (prismaCall) {
        const start = getTime();
        try {
          const result = target.apply(thisArg, argArray);
          const ret = recording.functionReturn(prismaCall.id, result, getTime() - start);
          return fixReturnEventIfPromiseResult(result, ret, prismaCall, start);
        } catch (exn: unknown) {
          recording.functionException(prismaCall.id, exn, getTime() - start);
          throw exn;
        }
      }

      return target.apply(thisArg, argArray);
    },
  });
}
