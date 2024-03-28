import { basename, relative } from "node:path";

import type { ESTree } from "meriyah";

import config from "./config";

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
  /** Class name, or the package name for a free function */
  klassOrFile: string;
  location?: SourceLocation;
  labels?: string[];
}

export function createFunctionInfo(
  fun: Omit<ESTree.FunctionDeclaration, "type" | "body"> & {
    id: ESTree.Identifier;
  },
  location: SourceLocation,
  labels?: string[],
): FunctionInfo {
  const { async, generator, id, params } = fun;
  const info = {
    async,
    generator,
    id: id.name,
    params: params.map(stripLocation),
    location: relativeLocation(location),
    klassOrFile: pkgOfPath(location.path),
    static: true,
    labels,
  };
  return info;
}

export function createMethodInfo(
  method: ESTree.MethodDefinition & { key: { name: string } },
  klass: (ESTree.ClassDeclaration | ESTree.ClassExpression) & { id: { name: string } },
  location?: SourceLocation,
  labels?: string[],
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
    klassOrFile: klass.id.name,
    location: relativeLocation(location),
    labels,
  };
  return info;
}

export function stripLocation(value: ESTree.Parameter): ESTree.Parameter {
  const result = { ...value };
  delete result.loc;
  return result;
}

function pkgOfPath(path: string): string {
  const base = basename(path);
  if (base.includes(".")) return base.split(".").slice(0, -1).join(".");
  else return base;
}

// return location relative to config.root
function relativeLocation(location: SourceLocation | undefined): SourceLocation | undefined {
  if (!location) return undefined;
  return {
    path: relative(config.root, location.path),
    lineno: location.lineno,
  };
}
