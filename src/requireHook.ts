import httpHook from "./hooks/http";
import pgHook from "./hooks/pg";

interface Hook {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mod: any): any;
  applicable(id: string): boolean;
}

const hooks: Hook[] = [httpHook, pgHook];

export default function requireHook(
  original: NodeJS.Require,
  thisArg: unknown,
  [id]: [string],
): unknown {
  const mod: unknown = original.apply(thisArg, [id]);
  const hook = hooks.find((h) => h.applicable(id));
  if (hook) return hook(mod);
  else return mod;
}
