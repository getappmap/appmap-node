import type { ESTree } from "meriyah";

export type Function = Omit<ESTree.FunctionDeclaration, "body">;

export const functions: Function[] = [];

export function addFunction(fun: ESTree.FunctionDeclaration): number {
  const fn = { ...fun };
  delete fn.body;

  const index = functions.length;
  functions.push(fn);
  return index;
}
