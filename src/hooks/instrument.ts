import assert from "node:assert";
import path from "node:path";
import { cwd } from "node:process";
import { fileURLToPath } from "node:url";

import { ancestor as walk } from "acorn-walk";
import { ESTree } from "meriyah";

import * as gen from "../generate";
import globals from "../globals";
import { addFunction, addMethod } from "../registry";
import findLast from "../util/findLast";

export function transform(program: ESTree.Program): ESTree.Program {
  walk(program, { FunctionDeclaration, MethodDefinition });
  return program;
}

function FunctionDeclaration(fun: ESTree.FunctionDeclaration) {
  if (!fun.body) return; // TODO instrument functions without a body
  const inner: ESTree.FunctionExpression = {
    ...fun,
    body: { ...fun.body },
    type: "FunctionExpression",
  };
  const index = addFunction(fun);
  fun.body.body = [
    gen.ret(gen.call_(globals.record, [gen.literal(index), gen.this_, gen.args, inner])),
  ];
}

function isClass(node: ESTree.Node): node is ESTree.ClassDeclaration | ESTree.ClassExpression {
  return node.type === "ClassDeclaration" || node.type === "ClassExpression";
}

function MethodDefinition(
  method: ESTree.MethodDefinition,
  state: unknown,
  ancestors: ESTree.Node[],
) {
  const klass = findLast(ancestors, isClass);
  assert(klass);
  const index = addMethod(method, klass);
  assert(method.value.body);
  assert(method.key?.type === "Identifier");
  const inner: ESTree.FunctionExpression = {
    ...method.value,
    id: method.key,
    body: { ...method.value.body },
  };
  method.value.body.body = [
    gen.ret(gen.call_(globals.record, [gen.literal(index), gen.this_, gen.args, inner])),
  ];
}

let root = cwd();

export function setRoot(path: string) {
  root = path;
}

export function shouldInstrument(url: URL): boolean {
  if (url.protocol !== "file:") return false;
  if (url.pathname.endsWith(".json")) return false;

  const filePath = fileURLToPath(url);
  if (filePath.includes("node_modules")) return false;
  if (isUnrelated(root, filePath)) return false;

  return true;
}

function isUnrelated(parentPath: string, targetPath: string) {
  const rel = path.relative(parentPath, targetPath);
  return rel === targetPath || rel.startsWith("..");
}
