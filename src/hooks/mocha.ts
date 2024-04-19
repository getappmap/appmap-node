import assert from "node:assert";
import { relative } from "node:path";
import { EventEmitter } from "node:stream";

import { simple as walk } from "acorn-walk";
import type { ESTree } from "meriyah";

import { expressionFor } from ".";
import config from "../config";
import { call_, this_ } from "../generate";
import { info } from "../message";
import { exceptionMetadata } from "../metadata";
import {
  abandonProcessRecordingIfNotAlwaysActive,
  getTestRecording,
  startTestRecording,
} from "../recorder";

export function shouldInstrument(url: URL): boolean {
  return url.pathname.endsWith("/mocha/lib/runner.js");
}

export function transform(program: ESTree.Program): ESTree.Program {
  // Find constructor of mocha Runner in ".../mocha/lib/runner.js".
  // Append an expression to constructor body for registering test
  // event listeners.
  walk(program, {
    ClassDeclaration(c: ESTree.ClassDeclaration) {
      if (c.id?.name !== "Runner") return;

      walk(c, {
        MethodDefinition(md: ESTree.MethodDefinition) {
          if (md.kind !== "constructor") return;

          assert(md.value.body);
          md.value.body.body.push({
            type: "ExpressionStatement",
            expression: call_(expressionFor(registerEventListeners), this_),
          });
          abandonProcessRecordingIfNotAlwaysActive();
          info("Detected Mocha. Tests will be automatically recorded.");
        },
      });
    },
  });

  return program;
}

/* Adding @types/mocha to the project seems to confuse tsc even when it's not explicitly imported.
   Instead, define the minimal needed type surface here. */
interface Test {
  titlePath: () => string[];
  file: string;
}

const EVENT_TEST_BEGIN = "test";
const EVENT_TEST_PASS = "pass";
const EVENT_TEST_FAIL = "fail";

function registerEventListeners(runner: EventEmitter) {
  runner.on(EVENT_TEST_BEGIN, function (test: Test) {
    const recording = startTestRecording("mocha", ...test.titlePath());
    if (test.file) recording.metadata.source_location = relative(config.root, test.file);
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  runner.on(EVENT_TEST_PASS, function (test: Test) {
    const recording = getTestRecording();
    recording.metadata.test_status = "succeeded";
    recording.finish();
  });

  runner.on(EVENT_TEST_FAIL, function (test: Test, err: unknown) {
    const recording = getTestRecording();
    recording.metadata.test_status = "failed";
    recording.metadata.exception = exceptionMetadata(err);
    recording.metadata.test_failure = {
      message: recording.metadata.exception?.message ?? "failed",
      location: test.file ? relative(config.root, test.file) : undefined,
    };
    recording.finish();
  });
}
