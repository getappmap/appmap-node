import { fileURLToPath } from "node:url";

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

function makeLocation(loc: ESTree.SourceLocation | null | undefined): SourceLocation | undefined {
  if (!loc?.source) return;
  return {
    path: loc.source.startsWith("file:") ? fileURLToPath(loc.source) : loc.source,
    lineno: loc.start.line,
  };
}

export function createFunctionInfo(
  fun: ESTree.FunctionDeclaration & {
    id: ESTree.Identifier;
  },
): FunctionInfo {
  const { async, generator, id, params, loc } = fun;
  const info = {
    async,
    generator,
    id: id.name,
    params,
    location: makeLocation(loc),
    static: true,
  };
  return info;
}

export function createMethodInfo(
  method: ESTree.MethodDefinition & { key: { name: string } },
  klass: (ESTree.ClassDeclaration | ESTree.ClassExpression) & { id: { name: string } },
): FunctionInfo {
  const {
    key,
    value: { async, generator, params },
  } = method;
  const info = {
    async,
    generator,
    id: key.name,
    params,
    static: method.static,
    klass: klass.id.name,
    location: makeLocation(method.loc),
  };
  return info;
}
