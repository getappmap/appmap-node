import assert from "assert";
import type { ESTree } from "meriyah";

export function call_(
  callee: ESTree.Expression,
  ...args: ESTree.Expression[]
): ESTree.CallExpression {
  return {
    type: "CallExpression",
    callee,
    arguments: args,
  };
}

export function assignment(
  left: ESTree.Expression,
  right: ESTree.Expression,
  operator = "=",
): ESTree.ExpressionStatement {
  return {
    type: "ExpressionStatement",
    expression: {
      type: "AssignmentExpression",
      left,
      operator,
      right,
    },
  };
}

export function member(
  object: ESTree.Expression,
  ...ids: (ESTree.Expression | string)[]
): ESTree.MemberExpression {
  for (const id of ids) {
    const property = typeof id === "string" ? identifier(id) : id;
    object = {
      type: "MemberExpression",
      object,
      property,
      computed: property.type !== "Identifier",
    };
  }

  assert(object.type === "MemberExpression");
  return object;
}

export function memberId(base: string, ...ids: string[]): ESTree.MemberExpression {
  return member(identifier(base), ...ids);
}

export type LiteralValue = ESTree.Literal["value"];

export function literal(value: LiteralValue): ESTree.Literal {
  return { type: "Literal", value };
}

export function identifier(id: string): ESTree.Identifier {
  return {
    type: "Identifier",
    name: id,
  };
}

export function toArrowFunction(
  f: ESTree.FunctionExpression | ESTree.FunctionDeclaration,
): ESTree.ArrowFunctionExpression {
  return {
    type: "ArrowFunctionExpression",
    params: f.params,
    async: f.async,
    body: f.body ?? { type: "BlockStatement", body: [] },
    expression: false,
  };
}

export function awaitImport(source: string): ESTree.AwaitExpression {
  return {
    type: "AwaitExpression",
    argument: {
      type: "ImportExpression",
      source: literal(source),
    },
  };
}

export function ret(argument: ESTree.Expression | null = null): ESTree.ReturnStatement {
  return {
    type: "ReturnStatement",
    argument,
  };
}

export function yieldStar(argument: ESTree.Expression | null = null): ESTree.ExpressionStatement {
  return {
    type: "ExpressionStatement",
    expression: { type: "YieldExpression", delegate: true, argument },
  };
}

export const args = identifier("arguments");
export const this_: ESTree.ThisExpression = { type: "ThisExpression" };
