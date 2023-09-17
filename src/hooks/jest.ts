import { pathToFileURL } from "node:url";

import { simple as walk } from "acorn-walk";
import type { ESTree } from "meriyah";
import type { Circus } from "@jest/types";

import { expressionFor, wrap } from ".";
import genericTranform from "../transform";
import { call_, identifier } from "../generate";
import { finishRecording, start } from "../recorder";
import { info } from "../message";

export function shouldInstrument(url: URL): boolean {
  return (
    url.pathname.endsWith("jest-runtime/build/index.js") ||
    url.pathname.endsWith("jest-circus/build/state.js")
  );
}

export function transform(program: ESTree.Program): ESTree.Program {
  if (program.loc?.source?.endsWith("index.js")) return patchRuntime(program);
  else return patchCircus(program);
}

export function patchRuntime(program: ESTree.Program): ESTree.Program {
  walk(program, {
    MethodDefinition(method: ESTree.MethodDefinition) {
      if (!isId(method.key, "transformFile")) return;
      method.value.body = wrap(method.value, transformJest);
    },
  });
  return program;
}

export function patchCircus(program: ESTree.Program): ESTree.Program {
  finishRecording(false);
  info("Detected Jest. Tests will be automatically recorded.");
  program.body.push({
    type: "ExpressionStatement",
    expression: call_(identifier("addEventHandler"), expressionFor(eventHandler)),
  });
  return program;
}

function isId(node: ESTree.Node | null, name: string) {
  return node?.type === "Identifier" && node.name === name;
}

function eventHandler(event: Circus.Event) {
  switch (event.name) {
    case "test_fn_start":
      start("jest", ...testNames(event.test));
      break;
    case "test_fn_failure":
    case "test_fn_success":
      finishRecording();
  }
}

export function transformJest(
  this: unknown,
  fun: (...args: [string]) => string,
  args: [string],
): string {
  const [filename] = args;
  return genericTranform(fun.apply(this, args), pathToFileURL(filename));
}

function testNames(test: Circus.TestEntry): string[] {
  const names = [test.name];
  for (let block = test.parent; block.parent; block = block.parent) names.push(block.name);
  return names.reverse();
}
