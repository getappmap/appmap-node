import assert from "node:assert";
import path from "node:path";
import { cwd } from "node:process";
import { fileURLToPath } from "node:url";

import { ancestor as walk } from "acorn-walk";
import { ESTree, parse } from "meriyah";
import { SourceMapConsumer } from "source-map-js";

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
import { FunctionInfo, SourceLocation, createMethodInfo, createFunctionInfo } from "../registry";
import findLast from "../util/findLast";

const __appmapFunctionRegistryIdentifier = identifier("__appmapFunctionRegistry");
export const transformedFunctionInfos: FunctionInfo[] = [];

function addTransformedFunctionInfo(fi: FunctionInfo): number {
  transformedFunctionInfos.push(fi);
  return transformedFunctionInfos.length - 1;
}

export function transform(program: ESTree.Program, sourceMap?: SourceMapConsumer): ESTree.Program {
  transformedFunctionInfos.splice(0);

  const locate = makeLocator(sourceMap);

  walk(program, {
    FunctionDeclaration(fun: ESTree.FunctionDeclaration) {
      if (!hasIdentifier(fun)) return;

      const location = locate(fun);
      if (sourceMap && !location) return; // don't instrument generated code

      fun.body = wrapWithRecord(fun, createFunctionInfo(fun, location), false);
    },

    MethodDefinition(method: ESTree.MethodDefinition, _: unknown, ancestors: ESTree.Node[]) {
      if (!methodHasName(method)) return;
      const klass = findLast(ancestors, isNamedClass);
      if (!klass) return;

      const location = locate(method);
      if (sourceMap && !location) return; // don't instrument generated code

      method.value.body = wrapWithRecord(
        { ...method.value },
        createMethodInfo(method, klass, location),
        method.kind === "constructor",
      );
    },
  });

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

function makeLocator(
  sourceMap?: SourceMapConsumer,
): (node: ESTree.Node) => SourceLocation | undefined {
  if (sourceMap)
    return ({ loc }: ESTree.Node) => {
      if (!loc?.source) return undefined;
      const mapped = sourceMap.originalPositionFor(loc.start);
      if (mapped?.line) return { path: mapped.source, lineno: mapped.line };
    };
  else
    return ({ loc }: ESTree.Node) =>
      loc?.source
        ? {
            path: loc.source.startsWith("file:") ? fileURLToPath(loc.source) : loc.source,
            lineno: loc.start.line,
          }
        : undefined;
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

let root = cwd();

export function setRoot(path: string) {
  root = path;
}

export function shouldInstrument(url: URL): boolean {
  if (url.protocol !== "file:") return false;
  if (url.pathname.endsWith(".json")) return false;

  const filePath = fileURLToPath(url);
  if (filePath.includes("node_modules") || filePath.includes(".yarn")) return false;
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
