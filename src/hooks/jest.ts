import { pathToFileURL } from "node:url";

import { simple as walk } from "acorn-walk";
import type { ESTree } from "meriyah";

import { wrap } from ".";
import genericTranform from "../transform";

export function shouldInstrument(url: URL): boolean {
  return url.pathname.endsWith("jest-runtime/build/index.js");
}

export function transform(program: ESTree.Program): ESTree.Program {
  walk(program, { MethodDefinition });
  return program;
}

function MethodDefinition(method: ESTree.MethodDefinition) {
  const { key } = method;
  if (!isId(key, "transformFile")) return;
  method.value.body = wrap(method.value, transformJest);
}

function isId(node: ESTree.Node | null, name: string) {
  return node?.type === "Identifier" && node.name === name;
}

export function transformJest(
  this: unknown,
  fun: (...args: [string]) => string,
  args: [string],
): string {
  const [filename] = args;
  return genericTranform(fun.apply(this, args), pathToFileURL(filename));
}
