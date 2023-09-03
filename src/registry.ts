import assert from "node:assert";

import type { ESTree } from "meriyah";

export interface FunctionInfo {
  id: ESTree.Identifier | null;
  generator: boolean;
  async: boolean;
  params: ESTree.Parameter[];
  static?: boolean;
}

export const functions: FunctionInfo[] = [];

export function addFunction(fun: ESTree.FunctionDeclaration): number {
  const index = functions.length;
  functions.push({
    async: fun.async,
    generator: fun.generator,
    id: fun.id,
    params: fun.params,
  });
  return index;
}

export function addMethod(method: ESTree.MethodDefinition): number {
  const index = functions.length;
  const { key, value } = method;
  assert(key?.type === "Identifier");
  functions.push({
    async: value.async,
    generator: value.generator,
    id: key,
    params: value.params,
    static: method.static,
  });
  return index;
}
