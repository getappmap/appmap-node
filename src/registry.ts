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

export const functions: FunctionInfo[] = [];

export function addFunction(
  fun: ESTree.FunctionDeclaration & {
    id: ESTree.Identifier;
  },
): number {
  const { async, generator, id, params, loc } = fun;
  const index = functions.length;
  functions.push({
    async,
    generator,
    id: id.name,
    params,
    location: makeLocation(loc),
    static: true,
  });
  return index;
}

export function addMethod(
  method: ESTree.MethodDefinition & { key: { name: string } },
  klass: (ESTree.ClassDeclaration | ESTree.ClassExpression) & { id: { name: string } },
): number {
  const index = functions.length;
  const {
    key,
    value: { async, generator, params },
  } = method;
  functions.push({
    async,
    generator,
    id: key.name,
    params,
    static: method.static,
    klass: klass.id.name,
    location: makeLocation(method.loc),
  });
  return index;
}

function makeLocation(loc: ESTree.SourceLocation | null | undefined): SourceLocation | undefined {
  if (!loc?.source) return;
  return {
    path: loc.source.startsWith("file:") ? fileURLToPath(loc.source) : loc.source,
    lineno: loc.start.line,
  };
}
