import assert from "node:assert";

import type mysql from "mysql";

import { getActiveRecordings, isActive } from "../recorder";
import { getTime } from "../util/getTime";

export default function mysqlHook(mod: typeof mysql) {
  // mysql.Connection type is an interface, create a dummy connection
  // object to access its prototype.
  const connection = mod.createConnection({});
  const prototype: unknown = Object.getPrototypeOf(connection);
  assert(prototype != undefined && typeof prototype === "object" && "query" in prototype);
  prototype.query = createQueryProxy(prototype.query as mysql.QueryFunction);

  return mod;
}

mysqlHook.applicable = function (id: string) {
  return id === "mysql";
};

function hasStringSqlProperty(o: unknown): o is { sql: string } {
  return o !== null && typeof o === "object" && "sql" in o && typeof o.sql === "string";
}

function createQueryProxy(query: mysql.QueryFunction) {
  return new Proxy(query, {
    apply(target, thisArg, argArray: Parameters<typeof query>) {
      // We have to cover these Connection.query call variants:
      //  - query(sql, callback?)
      //  - query(sql, values, callback?)
      //  - query(options, callback?)
      //  - query(options, values, callback?),
      // where
      //  - sql: string
      //  - options: {sql: string, ...}
      //  - callback: (error, results, fields) => void

      // Pool.query and PoolNamespace.query methods use Connection.query
      // https://github.com/mysqljs/mysql/blob/dc9c152a87ec51a1f647447268917243d2eab1fd/lib/Pool.js#L214
      // https://github.com/mysqljs/mysql/blob/dc9c152a87ec51a1f647447268917243d2eab1fd/lib/PoolNamespace.js#L111

      const sql: string = hasStringSqlProperty(argArray[0]) ? argArray[0].sql : argArray[0];

      const recordings = getActiveRecordings();
      const callEvents = recordings.map((recording) => recording.sqlQuery("mysql", sql));
      const startTime = getTime();

      const originalCallback =
        typeof argArray[argArray.length - 1] === "function"
          ? (argArray.pop() as mysql.queryCallback)
          : undefined;

      const newCallback: mysql.queryCallback = (err, results, fields) => {
        const elapsed = getTime() - startTime;
        if (err)
          recordings.forEach(
            (recording, idx) =>
              isActive(recording) && recording.functionException(callEvents[idx].id, err, elapsed),
          );
        else
          recordings.forEach(
            (recording, idx) =>
              isActive(recording) &&
              recording.functionReturn(callEvents[idx].id, undefined, elapsed),
          );

        originalCallback?.call(this, err, results, fields);
      };

      argArray.push(newCallback);

      return Reflect.apply(target, thisArg, argArray);
    },
  });
}
