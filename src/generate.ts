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

export function member(...ids: ESTree.Expression[]): ESTree.MemberExpression {
  assert(ids.length > 1);
  let result = [...ids];
  while (result.length > 1) {
    const [object, property, ...rest] = result;
    result = [
      { type: "MemberExpression", object, property, computed: property.type !== "Identifier" },
      ...rest,
    ];
  }
  assert(result[0].type === "MemberExpression");
  return result[0];
}

export function memberId(...ids: string[]): ESTree.MemberExpression {
  return member(...ids.map(identifier));
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
