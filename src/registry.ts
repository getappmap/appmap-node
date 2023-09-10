import assert from "node:assert";

import type { ESTree } from "meriyah";

export interface FunctionInfo {
  id?: string;
  generator: boolean;
  async: boolean;
  params: ESTree.Parameter[];
  static?: boolean;
  klass?: string;
  loc?: ESTree.SourceLocation;
}

export const functions: FunctionInfo[] = [];

export function addFunction(fun: ESTree.FunctionDeclaration): number {
  const index = functions.length;
  functions.push({
    async: fun.async,
    generator: fun.generator,
    id: fun.id?.name,
    params: fun.params,
    loc: fun.loc ?? undefined,
  });
  return index;
}

export function addMethod(
  method: ESTree.MethodDefinition,
  klass: ESTree.ClassDeclaration | ESTree.ClassExpression,
): number {
  const index = functions.length;
  const { key, value } = method;
  assert(key?.type === "Identifier");
  functions.push({
    async: value.async,
    generator: value.generator,
    id: key.name,
    params: value.params,
    static: method.static,
    klass: klass.id?.name,
    loc: method.loc ?? undefined,
  });
  return index;
}
