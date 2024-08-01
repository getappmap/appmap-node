import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { debuglog } from "node:util";

import { ancestor as walk } from "acorn-walk";
import { ESTree, parse } from "meriyah";
import { SourceMapConsumer } from "source-map-js";

import config from "../config";
import {
  args as args_,
  call_,
  identifier,
  literal,
  member,
  memberId,
  ret,
  this_,
  toArrowFunction,
  yieldStar,
} from "../generate";
import { FunctionInfo, SourceLocation, createFunctionInfo, createMethodInfo } from "../registry";
import findLast from "../util/findLast";
import { isId } from "../util/isId";
import CommentLabelExtractor from "./util/CommentLabelExtractor";

const debug = debuglog("appmap:instrument");

const __appmapFunctionRegistryIdentifier = identifier("__appmapFunctionRegistry");
export const transformedFunctionInfos: FunctionInfo[] = [];

function addTransformedFunctionInfo(fi: FunctionInfo): number {
  transformedFunctionInfos.push(fi);
  return transformedFunctionInfos.length - 1;
}

export function transform(
  program: ESTree.Program,
  sourceMap?: SourceMapConsumer,
  comments?: ESTree.Comment[],
): ESTree.Program {
  transformedFunctionInfos.splice(0);
  const source = program.loc?.source;
  const pkg = source ? config.packages.match(source) : undefined;

  const locate = makeLocator(sourceMap);
  const commentLabelExtractor = comments
    ? new CommentLabelExtractor(comments, sourceMap)
    : undefined;

  const getFunctionLabels = (name: string, line: number, klass?: string) => {
    const commentLabels = commentLabelExtractor?.labelsFor(line);
    const configLabels = config.getFunctionLabels(pkg, name, klass);
    if (commentLabels && configLabels)
      return [...commentLabels, ...configLabels.filter((l) => !commentLabels.includes(l))];
    return commentLabels ?? configLabels;
  };

  walk(program, {
    FunctionDeclaration(fun: ESTree.FunctionDeclaration) {
      if (!hasIdentifier(fun)) return;
      if (pkg?.exclude?.includes(fun.id.name)) return;

      const location = locate(fun);
      if (!location) return; // don't instrument generated code

      fun.body = wrapFunction(
        fun,
        createFunctionInfo(fun, location, getFunctionLabels(fun.id.name, location.lineno)),
        false,
      );
    },

    MethodDefinition(method: ESTree.MethodDefinition, _: unknown, ancestors: ESTree.Node[]) {
      if (!methodHasName(method)) return;
      // Can't record generator methods because of potential super keyword inside.
      if (method.value.generator) return;
      const klass = findLast(ancestors, isNamedClass);
      if (!klass) return;

      const { name } = method.key;
      const qname = [klass.id.name, name].join(".");

      // Not sure why eslint complains here, ?? is the wrong operator
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      if (pkg?.exclude?.includes(name) || pkg?.exclude?.includes(qname)) {
        debug(`Excluding ${qname}`);
        return;
      }

      const location = locate(method);
      if (!location) return; // don't instrument generated code

      debug(`Instrumenting ${qname}`);
      method.value.body = wrapFunction(
        { ...method.value },
        createMethodInfo(
          method,
          klass,
          location,
          getFunctionLabels(name, location.lineno, klass.id.name),
        ),
        method.kind === "constructor",
      );
    },

    // instrument arrow functions
    ArrowFunctionExpression(fun: ESTree.ArrowFunctionExpression, _, ancestors: ESTree.Node[]) {
      const location = locate(fun);
      if (!location) return; // don't instrument generated code

      const [declaration, declarator] = ancestors.slice(-3);
      switch (declarator.type) {
        // instrument consts
        case "VariableDeclarator": {
          if (!(declaration.type === "VariableDeclaration" && declaration.kind === "const")) return;
          const { id } = declarator;
          if (!isId(id)) return;
          if (pkg?.exclude?.includes(id.name)) return;
          assert(declarator.init === fun);

          debug(`Instrumenting ${id.name}`);
          declarator.init = wrapLambda(
            fun,
            createFunctionInfo(
              { ...fun, id, generator: false },
              location,
              getFunctionLabels(id.name, location.lineno),
            ),
          );
          break;
        }
        // instrument CommonJS exports
        case "AssignmentExpression": {
          const id = exportName(declarator.left);
          if (!id || pkg?.exclude?.includes(id.name)) return;

          debug(`Instrumenting ${id.name}`);
          declarator.right = wrapLambda(
            fun,
            createFunctionInfo(
              { ...fun, id, generator: false },
              location,
              getFunctionLabels(id.name, location.lineno),
            ),
          );
          break;
        }
      }
    },
  });

  if (transformedFunctionInfos.length === 0) return program;

  // Add a global variable to hold the function registry (see recorder.ts)
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

function wrapLambda(
  lambda: ESTree.ArrowFunctionExpression,
  functionInfo: FunctionInfo,
): ESTree.ArrowFunctionExpression {
  const args = identifier("$appmap$args");
  return {
    type: "ArrowFunctionExpression",
    async: lambda.async,
    expression: false,
    params: [
      {
        type: "RestElement",
        argument: args,
      },
    ],
    body: wrapCallable(lambda, functionInfo, identifier("undefined"), args),
  };
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

function wrapCallable(
  fd: ESTree.FunctionDeclaration | ESTree.FunctionExpression | ESTree.ArrowFunctionExpression,
  functionInfo: FunctionInfo,
  thisArg: ESTree.Expression,
  argsArg: ESTree.Expression,
): ESTree.CallExpression {
  // (1) Pass the function as an arrow function expression even if the original
  // function is not an arrow function, because of a potential super keyword inside.
  //    global.AppMapRecordHook.call(this|undefined, () => {...}, arguments, __appmapFunctionRegistry[i])
  //
  // (2) If it's a generator function then pass it as a generator function since
  // yield keyword cannot be used inside an arrow function. We don't care about (1)
  // since we don't transform generator methods due to the potential super keyword inside.
  //    yield* global.AppMapRecordHook.call(this|undefined, function* f() {...}, arguments, __appmapFunctionRegistry[i])

  let functionArgument: ESTree.Expression =
    fd.type === "ArrowFunctionExpression"
      ? fd
      : fd.generator
      ? { ...fd, type: "FunctionExpression" }
      : toArrowFunction(fd);

  // For regular (non-arrow) functions, we wrap the function, making the original
  // function body an inner function passed to the record call. To prevent double
  // execution of default value expressions, we omit the parameters since their
  // names will already be accessible within the inner function.
  //
  // In contrast, arrow functions are wrapped differently, using the "(...args) =>"
  // signature. For arrow functions, the parameter default value expressions are
  // transferred to the inner arrow function parameter declaration. Refer to the
  // instrument.transform test cases in instrument.test.ts for more details.
  if (fd.type != "ArrowFunctionExpression") functionArgument = { ...functionArgument, params: [] };

  return call_(
    memberId("global", "AppMapRecordHook", "call"),
    thisArg,
    functionArgument,
    argsArg,
    member(__appmapFunctionRegistryIdentifier, literal(addTransformedFunctionInfo(functionInfo))),
  );
}

function wrapFunction(
  fd: ESTree.FunctionDeclaration | ESTree.FunctionExpression,
  functionInfo: FunctionInfo,
  thisIsUndefined: boolean,
): ESTree.BlockStatement {
  const statement = fd.generator ? yieldStar : ret;

  const wrapped: ESTree.BlockStatement = {
    type: "BlockStatement",
    body: [
      statement(
        wrapCallable(fd, functionInfo, thisIsUndefined ? identifier("undefined") : this_, args_),
      ),
    ],
  };

  return wrapped;
}

export function shouldInstrument(url: URL): boolean {
  if (url.protocol !== "file:") return false;
  if (url.pathname.endsWith(".json")) return false;

  const filePath = fileURLToPath(url);
  return !!config.packages.match(filePath);
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

// returns the export name if expr is a CommonJS export member
function exportName(expr: ESTree.Expression): ESTree.Identifier | undefined {
  if (expr.type === "MemberExpression" && isId(expr.object, "exports")) {
    const { property } = expr;
    if (isId(property)) return property;
  }
  return undefined;
}
