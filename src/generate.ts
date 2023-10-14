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

export function ret(argument: ESTree.Expression | null = null): ESTree.ReturnStatement {
  return {
    type: "ReturnStatement",
    argument,
  };
}

export const args = identifier("arguments");
export const this_: ESTree.ThisExpression = { type: "ThisExpression" };
