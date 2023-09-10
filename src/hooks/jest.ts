import assert, { AssertionError } from "node:assert";
import { warn } from "node:console";
import { pathToFileURL } from "node:url";

import type { TransformTypes } from "@jest/types";
import { simple as walk } from "acorn-walk";
import type { ESTree } from "meriyah";

import * as gen from "../generate";
import globals from "../globals";
import genericTranform from "../transform";

export function shouldInstrument(url: URL): boolean {
  return url.pathname.endsWith("@jest/transform/build/ScriptTransformer.js");
}

export function transform(program: ESTree.Program): ESTree.Program {
  try {
    walk(program, { MethodDefinition });
  } catch (e) {
    assert(e instanceof AssertionError);
    warn(
      "Unknown Jest version. AppMap instrumentation cannot be applied.\n" +
        "Please report the problem and Jest version at https://github.com/getappmap/appmap-agent-js/issues\n",
      e,
    );
  }
  return program;
}

function MethodDefinition(method: ESTree.MethodDefinition) {
  const { key } = method;
  if (!isId(key, "transformSource")) return;

  const body = method.value.body;
  assert(body);

  walk(body, {
    ReturnStatement(ret: ESTree.ReturnStatement) {
      const arg = ret.argument;
      assert(arg);
      ret.argument = gen.call_(globals.transformJest, [
        gen.identifier("filename"),
        arg,
      ]);
    },
  });
}

function isId(node: ESTree.Node | null, name: string) {
  return node?.type === "Identifier" && node.name === name;
}

export function transformJest(
  filename: string,
  original: TransformTypes.TransformResult,
): TransformTypes.TransformResult {
  const xformed = genericTranform(original.code, pathToFileURL(filename));
  return { ...original, code: xformed };
}
