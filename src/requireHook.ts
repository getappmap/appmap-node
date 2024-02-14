import httpHook from "./hooks/http";
import mysqlHook from "./hooks/mysql";
import pgHook from "./hooks/pg";
import prismaHook from "./hooks/prisma";
import sqliteHook from "./hooks/sqlite";

interface Hook {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mod: any, id?: string): any;
  applicable(id: string): boolean;
}

const hooks: Hook[] = [httpHook, mysqlHook, pgHook, sqliteHook, prismaHook];

export default function requireHook(
  original: NodeJS.Require,
  thisArg: unknown,
  [id]: [string],
): unknown {
  const mod: unknown = original.apply(thisArg, [id]);
  const hook = hooks.find((h) => h.applicable(id));
  if (hook) return hook(mod, id);
  else return mod;
}
