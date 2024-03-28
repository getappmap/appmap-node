import httpHook from "./hooks/http";
import mongoHook from "./hooks/mongo";
import mysqlHook from "./hooks/mysql";
import pgHook from "./hooks/pg";
import prismaHook from "./hooks/prisma";
import sqliteHook from "./hooks/sqlite";
import librariesHook from "./hooks/libraries";

interface Hook {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mod: any, id: string): any;
  applicable(id: string): boolean;
}

const hooks: Hook[] = [
  httpHook,
  mongoHook,
  mysqlHook,
  pgHook,
  sqliteHook,
  prismaHook,
  librariesHook,
];

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
