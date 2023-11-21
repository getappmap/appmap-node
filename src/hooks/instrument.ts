import assert from "node:assert";
import path from "node:path";
import { cwd } from "node:process";
import { fileURLToPath } from "node:url";

import { ancestor as walk } from "acorn-walk";
import { ESTree, parse } from "meriyah";

import {
  args as args_,
  call_,
  identifier,
  literal,
  member,
  ret,
  this_,
  toArrowFunction,
} from "../generate";
import { FunctionInfo, createMethodInfo, createFunctionInfo } from "../registry";
import findLast from "../util/findLast";

const __appmapFunctionRegistryIdentifier = identifier("__appmapFunctionRegistry");
export const transformedFunctionInfos: FunctionInfo[] = [];

function addTransformedFunctionInfo(fi: FunctionInfo): number {
  transformedFunctionInfos.push(fi);
  return transformedFunctionInfos.length - 1;
}

export function transform(program: ESTree.Program): ESTree.Program {
  transformedFunctionInfos.splice(0);
  walk(program, { FunctionDeclaration, MethodDefinition });

  const functionRegistryAssignment: ESTree.VariableDeclaration = {
    type: "VariableDeclaration",
    declarations: [
      {
        type: "VariableDeclarator",
        id: __appmapFunctionRegistryIdentifier,
        init: {
          type: "ArrayExpression",
          elements: transformedFunctionInfos.map(objectLiteralExpression),
        },
      },
    ],
    kind: "const",
  };
  program.body.unshift(functionRegistryAssignment);

  return program;
}

function objectLiteralExpression(obj: object) {
  const objectExpressionString = JSON.stringify(obj);
  const parsed = parse(`(${objectExpressionString})`);

  assert(parsed.body.length === 1);
  assert(parsed.body[0].type === "ExpressionStatement");
  assert(parsed.body[0].expression.type === "ObjectExpression");

  return parsed.body[0].expression;
}

function wrapWithRecord(
  fd: ESTree.FunctionDeclaration | ESTree.FunctionExpression,
  functionInfo: FunctionInfo,
  thisIsUndefined: boolean,
) {
  const wrapped: ESTree.BlockStatement = {
    type: "BlockStatement",
    body: [
      // Statement: global.AppMapRecordHook(function f(...) {...}, __appmapFunctionRegistry[i]);
      ret(
        call_(
          member(...["global", "AppMapRecordHook", "call"].map(identifier)),
          thisIsUndefined ? identifier("undefined") : this_,
          toArrowFunction(fd),
          args_,
          member(
            __appmapFunctionRegistryIdentifier,
            literal(addTransformedFunctionInfo(functionInfo)),
          ),
        ),
      ),
    ],
  };

  return wrapped;
}

function FunctionDeclaration(fun: ESTree.FunctionDeclaration) {
  if (!hasIdentifier(fun)) return;
  if (isNotInteresting(fun)) return;
  fun.body = wrapWithRecord(fun, createFunctionInfo(fun), false);
}

function MethodDefinition(method: ESTree.MethodDefinition, _: unknown, ancestors: ESTree.Node[]) {
  if (!methodHasName(method)) return;
  const klass = findLast(ancestors, isNamedClass);
  if (!klass) return;

  method.value.body = wrapWithRecord(
    { ...method.value },
    createMethodInfo(method, klass),
    method.kind === "constructor",
  );
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

function isNotInteresting(fun: ESTree.FunctionDeclaration) {
  // When we import node:http in ts files "_interop_require_default"
  // function is injected to the source.
  if (fun.id?.name === "_interop_require_default") return true;

  return false;
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
