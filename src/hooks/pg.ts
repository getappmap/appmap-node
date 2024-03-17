import type pg from "pg";

import { fixReturnEventIfPromiseResult, recording } from "../recorder";
import { getTime } from "../util/getTime";

export default function pgHook(mod: typeof pg) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  mod.Client.prototype.query = createQueryProxy(mod.Client.prototype.query);
  // No need to proxy Pool.query because it calls Client.query internally
  return mod;
}

pgHook.applicable = function (id: string) {
  return id === "pg";
};

function hasStringTextProperty(o: unknown): o is { text: string } {
  return o !== null && typeof o === "object" && "text" in o && typeof o.text === "string";
}

function createQueryProxy(
  query: typeof pg.Client.prototype.query | typeof pg.Pool.prototype.query,
) {
  return new Proxy(query, {
    apply(target, thisArg, argArray: Parameters<typeof query>) {
      // https://github.com/brianc/node-postgres/blob/master/packages/pg/lib/client.js#L501
      // https://github.com/brianc/node-postgres/blob/master/packages/pg/lib/query.js#L8
      // https://github.com/brianc/node-postgres/blob/master/packages/pg/lib/utils.js#L149
      const sql: string = hasStringTextProperty(argArray[0]) ? argArray[0].text : argArray[0];

      const call = recording.sqlQuery("postgres", sql);
      const start = getTime();
      const result = target.apply(thisArg, argArray);
      const ret = recording.functionReturn(call.id, result, start);

      return fixReturnEventIfPromiseResult(result, ret, call, start);
    },
  });
}
