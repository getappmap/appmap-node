import assert from "node:assert";
import { fileURLToPath, pathToFileURL } from "node:url";
import { debuglog } from "node:util";

import { ancestor as walk, base as walkBase } from "acorn-walk";
import { extend as extendWalkWithJsx } from "acorn-jsx-walk";

// Teach acorn-walk to traverse JSX nodes produced by meriyah.
// Without this, walking a JSX AST throws "baseVisitor[type] is not a function".
extendWalkWithJsx(walkBase);
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
import { CustomSourceMapConsumer, shouldMatchOriginalSourcePaths } from "../transform";

const debug = debuglog("appmap:instrument");

const __appmapFunctionRegistryIdentifier = identifier("__appmapFunctionRegistry");
export const transformedFunctionInfos: FunctionInfo[] = [];

function addTransformedFunctionInfo(fi: FunctionInfo): number {
  transformedFunctionInfos.push(fi);
  return transformedFunctionInfos.length - 1;
}

export function transform(
  program: ESTree.Program,
  sourceMap?: CustomSourceMapConsumer,
  comments?: ESTree.Comment[],
): ESTree.Program {
  transformedFunctionInfos.splice(0);

  const locate = makeLocator(sourceMap);
  const commentLabelExtractor = comments
    ? new CommentLabelExtractor(comments, sourceMap)
    : undefined;

  const getFunctionLabels = (name: string, location: SourceLocation, klass?: string) => {
    const commentLabels = commentLabelExtractor?.labelsFor(location.lineno);
    const pkg = config().packages.match(location.path);
    const configLabels = config().getFunctionLabels(pkg, name, klass);
    if (commentLabels && configLabels)
      return [...commentLabels, ...configLabels.filter((l) => !commentLabels.includes(l))];
    return commentLabels ?? configLabels;
  };

  const originalSourceShouldBeInstrumented = new Map<string, boolean>();
  const shouldSkipFunction = (
    location: SourceLocation | undefined,
    name: string,
    qname?: string,
  ) => {
    if (!location) return true; // don't instrument generated code

    // A function may reside in a bundled file. If we have a source map
    // we check if the original source of the function should be instrumented.
    if (sourceMap?.originalSources.length) {
      if (!originalSourceShouldBeInstrumented.has(location.path)) {
        const url = pathToFileURL(location.path);
        const originalSource = sourceMap.originalSources.find((s) => s.href == url.href);
        originalSourceShouldBeInstrumented.set(
          location.path,
          originalSource != undefined && shouldInstrument(originalSource),
        );
      }
      if (!originalSourceShouldBeInstrumented.get(location.path)) return true;
    }

    // check if the function is explicitly excluded in config
    const pkg = config().packages.match(location.path);
    if (pkg?.exclude?.includes(name)) return true;
    if (qname && pkg?.exclude?.includes(qname)) return true;
  };

  walk(program, {
    FunctionDeclaration(fun: ESTree.FunctionDeclaration) {
      if (!hasIdentifier(fun)) return;

      const location = locate(fun);
      if (shouldSkipFunction(location, fun.id.name)) return;
      assert(location);

      fun.body = wrapFunction(
        fun,
        createFunctionInfo(fun, location, getFunctionLabels(fun.id.name, location)),
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

      const location = locate(method);
      if (shouldSkipFunction(location, name, qname)) return;
      assert(location);

      debug(`Instrumenting ${qname}`);
      method.value.body = wrapFunction(
        { ...method.value },
        createMethodInfo(method, klass, location, getFunctionLabels(name, location, klass.id.name)),
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

          if (shouldSkipFunction(location, id.name)) return;
          assert(location);

          assert(declarator.init === fun);

          debug(`Instrumenting ${id.name}`);
          declarator.init = wrapLambda(
            fun,
            createFunctionInfo(
              { ...fun, id, generator: false },
              location,
              getFunctionLabels(id.name, location),
            ),
          );
          break;
        }
        // instrument CommonJS exports
        case "AssignmentExpression": {
          const id = exportName(declarator.left);

          if (!id) return;

          if (shouldSkipFunction(location, id.name)) return;
          assert(location);

          debug(`Instrumenting ${id.name}`);
          declarator.right = wrapLambda(
            fun,
            createFunctionInfo(
              { ...fun, id, generator: false },
              location,
              getFunctionLabels(id.name, location),
            ),
          );
          break;
        }
      }
    },
  });

  if (transformedFunctionInfos.length === 0) return program;

  // Add these to prevent crash from shadowing of "global" and/or "globalThis".
  if (config().generateGlobalRecordHookCheck) {
    program.body.unshift(__appmapRecordVariableDeclaration);
    program.body.unshift(__appmapRecordInitFunctionDeclaration);
  }

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
  //    __appmapRecord.call(this|undefined, () => {...}, arguments, __appmapFunctionRegistry[i])
  //
  // (2) If it's a generator function then pass it as a generator function since
  // yield keyword cannot be used inside an arrow function. We don't care about (1)
  // since we don't transform generator methods due to the potential super keyword inside.
  //    yield* __appmapRecord.call(this|undefined, function* f() {...}, arguments, __appmapFunctionRegistry[i])

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
    config().generateGlobalRecordHookCheck
      ? memberId("__appmapRecord", "call")
      : memberId("global", "AppMapRecordHook", "call"),
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

function shouldInstrument_(url: URL) {
  if (url.protocol !== "file:") return false;
  if (url.pathname.endsWith(".json")) return false;

  const filePath = fileURLToPath(url);
  return !!config().packages.match(filePath);
}

// If there is a source map, check whether there is at least one original source
// that needs to be instrumented. If so, we should send the "bundled" URL to
// instrument.transform(), but within it, we should check each function to determine
// if its original source URL needs to be instrumented.
export function shouldInstrument(url: URL, sourceMap?: CustomSourceMapConsumer): boolean {
  if (sourceMap?.originalSources.length && shouldMatchOriginalSourcePaths(url))
    return sourceMap.originalSources.some((s) => shouldInstrument_(s));

  const result = shouldInstrument_(url);
  return result;
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

export const __appmapRecordVariableDeclarationCode = `const __appmapRecord = __appmapRecordInit()`;
const __appmapRecordVariableDeclaration = parse(__appmapRecordVariableDeclarationCode, {
  module: true,
}).body[0] as ESTree.VariableDeclaration;

export const __appmapRecordInitFunctionDeclarationCode = `
  function __appmapRecordInit() {
    let g = null;
    try {
      g = global.AppMapRecordHook;
    } catch (e) {
      try {
        g = globalThis.AppMapRecordHook;
      } catch (e) {}
      // If global/globalThis is shadowed in the top level, we'll get:
      // ReferenceError: Cannot access 'global' before initialization    
    }
    // Bypass recording if we can't access recorder to prevent a crash.
    return g ?? ((fun, argsArg) => fun.apply(this, argsArg));
  }`;
const __appmapRecordInitFunctionDeclaration = parse(__appmapRecordInitFunctionDeclarationCode, {
  module: true,
}).body[0] as ESTree.FunctionDeclaration;
