import assert from "node:assert";

import type { ESTree } from "meriyah";

export type FunctionInfo = Omit<ESTree.FunctionDeclaration, "body" | "type">;

export const functions: FunctionInfo[] = [];

export function addFunction(fun: ESTree.FunctionDeclaration): number {
  const fn = { ...fun };
  delete fn.body;

  const index = functions.length;
  functions.push(fn);
  return index;
}

export function addMethod(method: ESTree.MethodDefinition): number {
  const index = functions.length;
  assert(method.key?.type === "Identifier");
  functions.push({
    ...method.value,
    id: method.key,
  });
  return index;
}
