import path from "node:path";
import { cwd } from "node:process";
import { fileURLToPath } from "node:url";

import { ancestor as walk } from "acorn-walk";
import { ESTree } from "meriyah";

import { wrap } from ".";
import { record } from "../recorder";
import { addFunction, addMethod } from "../registry";
import findLast from "../util/findLast";

export function transform(program: ESTree.Program): ESTree.Program {
  walk(program, { FunctionDeclaration, MethodDefinition });
  return program;
}

function FunctionDeclaration(fun: ESTree.FunctionDeclaration) {
  if (!hasIdentifier(fun)) return;
  fun.body = wrap(fun, record, addFunction(fun));
}

function MethodDefinition(method: ESTree.MethodDefinition, _: unknown, ancestors: ESTree.Node[]) {
  if (!methodHasName(method)) return;
  const klass = findLast(ancestors, isNamedClass);
  if (!klass) return;
  method.value.body = wrap({ ...method.value }, record, addMethod(method, klass));
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

function hasIdentifier(
  fun: ESTree.FunctionDeclaration,
): fun is ESTree.FunctionDeclaration & { id: ESTree.Identifier } {
  return fun.id !== null;
}

function isNamedClass(
  node: ESTree.Node,
): node is (ESTree.ClassDeclaration | ESTree.ClassExpression) & { id: ESTree.Identifier } {
  return (node.type === "ClassDeclaration" || node.type === "ClassExpression") && node.id !== null;
}

function methodHasName(
  method: ESTree.MethodDefinition,
): method is ESTree.MethodDefinition & { key: { name: string } } {
  return method.key !== null && "name" in method.key;
}
