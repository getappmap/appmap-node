import path from "node:path";
import { cwd } from "node:process";
import { fileURLToPath } from "node:url";
import { ESTree } from "meriyah";
import { simple as walk } from "acorn-walk";
import * as gen from "../generate.js";
import { addFunction } from "../registry.js";
import globals from "../globals.js";

export function transform(program: ESTree.Program): ESTree.Program {
  walk(program, { FunctionDeclaration });
  return program;
}

function FunctionDeclaration(fun: ESTree.FunctionDeclaration) {
  if (!fun.body) return; // TODO instrument functions without a body
  const arrow: ESTree.FunctionExpression = {
    ...fun,
    body: { ...fun.body },
    type: "FunctionExpression",
  };
  const index = addFunction(fun);
  fun.body.body = [
    gen.ret(
      gen.call_(globals.record, [
        gen.literal(index),
        gen.this_,
        gen.args,
        arrow,
      ]),
    ),
  ];
}

const root = cwd();

export function shouldInstrument(url: URL): boolean {
  if (url.protocol !== "file:") return false;

  const filePath = fileURLToPath(url);
  if (filePath.includes("node_modules")) return false;
  if (isUnrelated(root, filePath)) return false;

  return true;
}

function isUnrelated(parentPath: string, targetPath: string) {
  const rel = path.relative(parentPath, targetPath);
  return rel === targetPath || rel.startsWith("..");
}
