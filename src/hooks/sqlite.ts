/* eslint-disable @typescript-eslint/unbound-method */
import type sqlite from "sqlite3";

import { recording } from "../recorder";
import { getTime } from "../util/getTime";

type RecordingProxyTarget =
  | typeof sqlite.Database.prototype.exec
  | typeof sqlite.Statement.prototype.run
  | typeof sqlite.Statement.prototype.all
  | typeof sqlite.Statement.prototype.get
  | typeof sqlite.Statement.prototype.each;

export default function sqliteHook(mod: typeof sqlite) {
  mod.Statement.prototype.run = createRecordingProxy(mod.Statement.prototype.run);
  mod.Statement.prototype.all = createRecordingProxy(mod.Statement.prototype.all);
  mod.Statement.prototype.get = createRecordingProxy(mod.Statement.prototype.get);
  mod.Statement.prototype.each = createRecordingProxy(mod.Statement.prototype.each, true);

  // Database run, all, get, each delegate to Statement
  mod.Database.prototype.exec = createRecordingProxy(mod.Database.prototype.exec);

  return mod;
}

sqliteHook.applicable = function (id: string) {
  return id === "sqlite3";
};

function hasSqlStringProperty(obj: unknown): obj is { sql: string } {
  return obj != null && typeof obj === "object" && "sql" in obj && typeof obj.sql === "string";
}

// https://github.com/TryGhost/node-sqlite3/wiki/API
function createRecordingProxy<T extends RecordingProxyTarget>(
  proxyTarget: T,
  needsRowCallback = false,
) {
  return new Proxy(proxyTarget, {
    apply(target, thisArg, argArray: Parameters<typeof proxyTarget>) {
      // Extract sql. If thisArg is a Statement then it has a sql property.
      // Otherwise thisArg is a Database and the sql must be the first element of the argArray.
      let sql: string;
      if (hasSqlStringProperty(thisArg)) sql = thisArg.sql;
      else {
        // If there is no sql provided, short circuit to the original function
        // to make it throw an error.
        if (argArray.length === 0 || typeof argArray[0] !== "string")
          return Reflect.apply(target, thisArg, argArray) as T;

        sql = argArray[0];
      }

      const call = recording.sqlQuery("sqlite", sql);
      const start = getTime();

      // Extract callback argument(s) to functionArgs
      const functionArgs = [];
      const lastArgIsaFunction = () =>
        argArray.length > 0 && typeof argArray[argArray.length - 1] === "function";
      if (lastArgIsaFunction()) functionArgs.unshift(argArray.pop());
      if (needsRowCallback && lastArgIsaFunction()) functionArgs.unshift(argArray.pop());

      // if needsRowCallback:
      //   functionArgs is [] or [rowCallback] or [rowCallback, completionCallback]
      // otherwise:
      //   functionArgs is [] or [completionCallback]

      const newFunctionArgs: unknown[] = [];

      if (needsRowCallback)
        // First element in functionArgs, if exists, is a row callback.
        // If the row callback is not provided, we provide an empty row callback to get
        // the next function argument treated as a completion handler.
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        newFunctionArgs.push(functionArgs.shift() ?? (() => {}));

      // Remaining element in functionArgs, if exists, is a completion callback.
      const originalCompletionCallback = functionArgs.shift() as
        | undefined
        | ((...args: unknown[]) => unknown);

      const newCompletionCallback = (...args: unknown[]) => {
        const isError = args.length > 0 && args[0] != undefined;
        if (!isError) recording.functionReturn(call.id, undefined, start);
        originalCompletionCallback?.apply(this, args);
      };
      newFunctionArgs.push(newCompletionCallback);

      return Reflect.apply(target, thisArg, [...argArray, ...newFunctionArgs]) as T;
    },
  });
}
