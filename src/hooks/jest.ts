import { pathToFileURL } from "node:url";

import type { Circus } from "@jest/types";
import { simple as walk } from "acorn-walk";
import type { ESTree } from "meriyah";

import { expressionFor, wrap } from ".";
import Recording from "../Recording";
import { call_, identifier } from "../generate";
import { info } from "../message";
import { exceptionMetadata } from "../metadata";
import { recording, start } from "../recorder";
import genericTranform from "../transform";
import { isId } from "../util/isId";

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
      method.value.body = wrap(method.value, transformJest, method.kind === "constructor");
    },
  });
  return program;
}

export function patchCircus(program: ESTree.Program): ESTree.Program {
  recording.abandon();
  info("Detected Jest. Tests will be automatically recorded.");
  program.body.push({
    type: "ExpressionStatement",
    expression: call_(identifier("addEventHandler"), expressionFor(eventHandler)),
  });
  return program;
}

function eventHandler(event: Circus.Event) {
  switch (event.name) {
    case "test_fn_start":
      start(createRecording(event.test));
      break;
    case "test_fn_failure":
      recording.metadata.test_status = "failed";
      recording.metadata.exception = exceptionMetadata(event.error);
      return recording.finish();
    case "test_fn_success":
      recording.metadata.test_status = "succeeded";
      return recording.finish();
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

function createRecording(test: Circus.TestEntry): Recording {
  const recording = new Recording("tests", "jest", ...testNames(test));
  return recording;
}
