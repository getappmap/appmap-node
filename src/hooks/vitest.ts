import assert from "node:assert";
import { relative } from "node:path";
import { pathToFileURL } from "node:url";
import worker from "node:worker_threads";

import { simple as walk } from "acorn-walk";
import { type ESTree } from "meriyah";

import config from "../config";
import fwdSlashPath from "../util/fwdSlashPath";
import {
  args as args_,
  assignment,
  awaitImport,
  call_,
  identifier,
  literal,
  member,
  memberId,
  ret,
} from "../generate";
import { info, warn } from "../message";
import {
  abandonProcessRecordingIfNotAlwaysActive,
  getTestRecording,
  startTestRecording,
} from "../recorder";
import genericTransform from "../transform";

function createInitChannel() {
  return new worker.BroadcastChannel("appmap-node/vitest/initialized");
}

// There can be 3 processes (p1, p2, p3) and many threads involved depending on the
// node version and vitest threading arguments. Each thread will load this file so we have to
// determine in which process and thread we are going to listen for initialization message.
// Omitting this ugly check and not preventing "innocent" creation of the initChannel in wrong
// processes and threads results in issues (process hangs). Also, we want to avoid listening in
// more than one thread to prevent multiple info messages.
// p1: node .../.yarn/releases/yarn-3.6.3.cjs vitest run [--no-threads] [--single-thread]
// p2: node .../vitest/vitest.mjs run [--no-threads] [--single-thread]
// p3: node .../vitest/dist/child.js (this process exists only in --no-threads mode)
function shouldListenForInit() {
  const isNoThreadsModeMainThread =
    worker.isMainThread && process.argv.length > 1 && process.argv[1].endsWith("child.js");
  const [major, ,] = process.versions.node.split(".").map(Number);
  // There will be 2 threads (#0, #1) in [--no-threads, node 20], so we don't want
  // to listen in thread #1 for other modes in this case. On the other hand,
  // we don't have thread #2 in [--single-thread node 18], but we can listen
  // in thread #1 because we don't have #1 in [--no-threads node 18].
  // Thus we guarantee that a single thread listens in all node versions and thread modes combinations.
  const threadIdToListenInOtherModes = major >= 20 ? 2 : 1;
  return isNoThreadsModeMainThread || worker.threadId === threadIdToListenInOtherModes;
}

if (shouldListenForInit()) {
  const initChannel = createInitChannel();
  let initialized = false;
  initChannel.onmessage = () => {
    if (initialized) return;
    info("Detected Vitest. Tests will be automatically recorded.");
    initialized = true;
  };
}

const vitestRunnerIndexJsFilePathEnding = "/@vitest/runner/dist/index.js";
// vitest v3 splits runTest into chunk-hooks.js; index.js is just re-exports
const vitestRunnerChunkHooksJsFilePathEnding = "/@vitest/runner/dist/chunk-hooks.js";
const viteNodeClientMjsFilePathEnding = "/vite-node/dist/client.mjs";
// vitest v4 uses vite's built-in module runner instead of vite-node
const viteModuleRunnerJsFilePathEnding = "/vite/dist/node/module-runner.js";
// vitest v4 uses VitestModuleEvaluator instead of ESModulesEvaluator
const vitestModuleEvaluatorJsFilePathEnding = "/vitest/dist/module-evaluator.js";

export function shouldInstrument(url: URL): boolean {
  // 1. …/vite-node/dist/client.mjs ViteNodeRunner.runModule (vitest v0-v3)
  //    or …/vite/dist/node/module-runner.js ESModulesEvaluator.runInlinedModule (vitest v4)
  //    is the place to transform test and user files
  // 2. @vitest/runner/dist/index.js (or chunk-hooks.js for v3) runTest
  //    is the place to intercept test before and afters
  return (
    url.pathname.endsWith(vitestRunnerIndexJsFilePathEnding) ||
    url.pathname.endsWith(vitestRunnerChunkHooksJsFilePathEnding) ||
    url.pathname.endsWith(viteNodeClientMjsFilePathEnding) ||
    url.pathname.endsWith(viteModuleRunnerJsFilePathEnding) ||
    url.pathname.endsWith(vitestModuleEvaluatorJsFilePathEnding)
  );
}

// Wraps @vitest/runner/dist/index.js runTest
export async function wrapRunTest(
  fun: (test: Test, runner: VitestRunner) => unknown,
  args: [Test, VitestRunner],
): Promise<unknown> {
  const [test] = args;

  abandonProcessRecordingIfNotAlwaysActive();
  startTestRecording("vitest", ...testNames(test));

  // Use try/finally so recording.finish() is always called even when tests throw.
  // vitest v1+ propagates test errors through the Promise (unlike v0 which catches
  // them internally and resolves with test.result.state = "fail").
  let threw = false;
  try {
    return await fun(...args);
  } catch (e) {
    threw = true;
    throw e;
  } finally {
    const recording = getTestRecording();
    if (test.file?.filepath)
      recording.metadata.source_location = fwdSlashPath(
        relative(config().root, test.file.filepath),
      );

    const state = test.result?.state ?? (threw ? "fail" : "pass");
    switch (state) {
      case "pass":
        recording.metadata.test_status = "succeeded";
        break;
      case "fail":
        recording.metadata.test_status = "failed";
        recording.metadata.test_failure = {
          message: "failed",
          location: recording.metadata.source_location,
        };
        if (test.result?.errors?.length) {
          const [{ name, message }] = test.result.errors;
          recording.metadata.exception = { class: name, message };
          recording.metadata.test_failure.message = message;
        }
        break;
      default:
        warn(`Test result not understood for test ${test.name}: ${test.result?.state}`);
    }
    recording.finish();
  }
}

function patchRunTest(fd: ESTree.FunctionDeclaration) {
  const wrapped: ESTree.BlockStatement = {
    type: "BlockStatement",
    body: [
      // Statement: return await import(".../vitest.js").wrapRunTest(function runTest(...) {...}, arguments);
      ret(
        call_(
          member(awaitImport(pathToFileURL(__filename).href), identifier(wrapRunTest.name)),
          { ...fd, type: "FunctionExpression" },
          args_,
        ),
      ),
    ],
  };
  fd.body = wrapped;

  createInitChannel().postMessage(undefined);
}

export function transformCode(code: string, pathOrUrl: string): string {
  const url = pathOrUrl.startsWith("file://") ? new URL(pathOrUrl) : pathToFileURL(pathOrUrl);
  return genericTransform(code, url);
}

// Patches …/vite-node/dist/client.mjs ViteNodeRunner.runModule
function patchRunModule(md: ESTree.MethodDefinition) {
  // Statement: transformed = await import(".../vitest.js").transformCode(transformed, context.__filename)
  const transformCodeStatement = assignment(
    identifier("transformed"),
    call_(
      member(awaitImport(pathToFileURL(__filename).href), identifier(transformCode.name)),
      identifier("transformed"),
      memberId("context", "__filename"),
    ),
  );

  assert(md.value.body);
  md.value.body.body.unshift(transformCodeStatement);
}

// Patches …/vite/dist/node/module-runner.js ESModulesEvaluator.runInlinedModule
function patchRunInlinedModule(md: ESTree.MethodDefinition) {
  // Statement: code = await import(".../vitest.js").transformCode(code, context["__vite_ssr_import_meta__"].url)
  const transformCodeStatement = assignment(
    identifier("code"),
    call_(
      member(awaitImport(pathToFileURL(__filename).href), identifier(transformCode.name)),
      identifier("code"),
      member(identifier("context"), literal("__vite_ssr_import_meta__"), identifier("url")),
    ),
  );

  assert(md.value.body);
  md.value.body.body.unshift(transformCodeStatement);
}

export function transform(program: ESTree.Program): ESTree.Program {
  const source = program.loc?.source;
  if (
    source?.endsWith(vitestRunnerIndexJsFilePathEnding) ||
    source?.endsWith(vitestRunnerChunkHooksJsFilePathEnding)
  )
    walk(program, {
      FunctionDeclaration(fd: ESTree.FunctionDeclaration) {
        if (fd.id?.name === "runTest") patchRunTest(fd);
      },
    });
  else if (source?.endsWith(viteNodeClientMjsFilePathEnding))
    walk(program, {
      ClassDeclaration(cd: ESTree.ClassDeclaration) {
        if (cd.id?.name === "ViteNodeRunner") {
          walk(cd, {
            MethodDefinition(md: ESTree.MethodDefinition) {
              if (md.key?.type === "Identifier" && md.key.name === "runModule") patchRunModule(md);
            },
          });
        }
      },
    });
  else if (
    source?.endsWith(viteModuleRunnerJsFilePathEnding) ||
    source?.endsWith(vitestModuleEvaluatorJsFilePathEnding)
  )
    walk(program, {
      MethodDefinition(md: ESTree.MethodDefinition) {
        if (md.key?.type === "Identifier" && md.key.name === "runInlinedModule")
          patchRunInlinedModule(md);
      },
    });

  return program;
}

// https://github.com/vitest-dev/vitest/blob/main/packages/runner/src/types/runner.ts
type VitestRunner = unknown;

// https://github.com/vitest-dev/vitest/blob/main/packages/runner/src/types/tasks.ts
type Test = Task;

interface Task {
  name: string;
  type?: string;
  suite?: Suite;
  result?: TaskResult;
  file?: { filepath?: string };
}
interface Suite {
  name: string;
  suite?: Suite;
}
interface TaskResult {
  state?: "pass" | "fail";
  errors?: Error[];
}

function testNames(test: Test): string[] {
  const names = [test.name];
  for (let block = test.suite; block?.suite; block = block.suite) names.push(block.name);
  return names.reverse();
}
