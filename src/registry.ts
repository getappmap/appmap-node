import type { ESTree } from "meriyah";

export interface SourceLocation {
  path: string;
  lineno: number;
}

export interface FunctionInfo {
  id: string;
  generator: boolean;
  async: boolean;
  params: ESTree.Parameter[];
  static: boolean;
  klass?: string;
  location?: SourceLocation;
}

export function createFunctionInfo(
  fun: ESTree.FunctionDeclaration & {
    id: ESTree.Identifier;
  },
  location?: SourceLocation,
): FunctionInfo {
  const { async, generator, id, params } = fun;
  const info = {
    async,
    generator,
    id: id.name,
    params: params.map(stripLocation),
    location,
    static: true,
  };
  return info;
}

export function createMethodInfo(
  method: ESTree.MethodDefinition & { key: { name: string } },
  klass: (ESTree.ClassDeclaration | ESTree.ClassExpression) & { id: { name: string } },
  location?: SourceLocation,
): FunctionInfo {
  const {
    key,
    value: { async, generator, params },
  } = method;
  const info = {
    async,
    generator,
    id: key.name,
    params: params.map(stripLocation),
    static: method.static,
    klass: klass.id.name,
    location,
  };
  return info;
}

function stripLocation(value: ESTree.Parameter): ESTree.Parameter {
  const result = { ...value };
  delete result.loc;
  return result;
}
