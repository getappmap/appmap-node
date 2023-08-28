import { parse, ESTree } from "meriyah";
import { simple as walk } from "acorn-walk";
import { generate } from "astring";
import * as gen from "./generate.js";
import { addFunction } from "./registry.js";

export default function instrument(code: string, url: URL): string {
  const tree = parse(code, { source: url.toString() });
  walk(tree, { FunctionDeclaration });
  return generate(tree);
}

const record = gen.member(["global", "AppMap", "record"].map(gen.identifier));
const args = gen.identifier("arguments");
const this_ = gen.identifier("this");

function FunctionDeclaration(fun: ESTree.FunctionDeclaration) {
  if (!fun.body) return; // TODO instrument functions without a body
  const arrow: ESTree.FunctionExpression = {
    ...fun,
    body: { ...fun.body },
    type: "FunctionExpression",
  };
  const index = addFunction(fun);
  fun.body.body = [
    gen.ret(gen.call_(record, [gen.literal(index), this_, args, arrow])),
  ];
}
