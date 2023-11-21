import { ESTree } from "meriyah";
import {
  call_,
  ret,
  args as args_,
  literal,
  LiteralValue,
  member,
  identifier,
  toArrowFunction,
  this_,
} from "../generate";

type Hook<This, Args extends unknown[], Return, Data extends unknown[]> = (
  this: This,
  fun: (this: This, ...args: Args) => Return,
  args: Args,
  ...data: Data
) => Return;

type ESFunction = ESTree.FunctionDeclaration | ESTree.FunctionExpression;

export function wrap<This, Args extends unknown[], Return, Data extends LiteralValue[]>(
  fun: ESFunction,
  hook: Hook<This, Args, Return, Data>,
  thisIsUndefined: boolean,
  ...args: Data
): ESTree.BlockStatement {
  const inner: ESTree.FunctionExpression = { ...fun, type: "FunctionExpression" };
  return {
    type: "BlockStatement",
    body: [
      ret(
        call_(
          member(expressionFor(hook), identifier("call")),
          thisIsUndefined ? identifier("undefined") : this_,
          toArrowFunction(inner),
          args_,
          ...args.map(literal),
        ),
      ),
    ],
  };
}

const globalAppMap = member(...["global", "AppMap"].map(identifier));

export function expressionFor(obj: unknown): ESTree.Expression {
  return member(globalAppMap, literal(indexFor(obj)));
}

declare global {
  // eslint-disable-next-line no-var
  var AppMap: unknown[];
}

global.AppMap = [];

function indexFor(obj: unknown): number {
  const index = AppMap.indexOf(obj);
  if (index === -1) {
    AppMap.push(obj);
    return AppMap.length - 1;
  } else return index;
}
