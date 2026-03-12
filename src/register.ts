import Module from "node:module";
import { pathToFileURL } from "node:url";

import config from "./config.js";
import { warn } from "./message.js";
import { record } from "./recorder.js";
import requireHook from "./requireHook.js";
import transform from "./transform.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Module {
      _compile: (code: string, fileName: string) => string;
    }
  }
}

const originalCompile = Module.prototype._compile;

Module.prototype._compile = function _compile(code: string, fileName: string): string {
  const xformed = transform(code, pathToFileURL(fileName));
  return originalCompile.call(this, xformed, fileName);
};

// eslint-disable-next-line @typescript-eslint/unbound-method
Module.prototype.require = new Proxy(Module.prototype.require, {
  apply: requireHook,
});

declare global {
  var AppMapRecordHook: typeof record;
}
global.AppMapRecordHook = record;

const cjsRequire = Module.createRequire(__filename);

// Pre-patch library modules in the main thread so they're already instrumented before any ESM
// module imports them. The ESM load() hook cannot transform built-in modules (node:http etc.)
// since they have no source, and for CJS-format third-party libraries the CJS cache is the only
// shared state between the loader thread and the main thread. register.ts runs via --require
// before any ESM evaluation, so these require() calls are race-free.
function prePatch(id: string, { warnOnFailure = false } = {}) {
  try {
    cjsRequire(id);
  } catch (err: unknown) {
    if (!warnOnFailure) return;
    // Warn rather than crash. The module may not be installed, or it may be
    // installed but broken (bad transitive dep, syntax error, etc.). Either
    // way, if the application never actually imports it the problem is
    // invisible without appmap — crashing the process here would make appmap
    // appear to be the cause. A warning gives the user enough context to
    // investigate without interrupting their workflow.
    const detail = err instanceof Error ? err.message : String(err);
    warn(`could not pre-patch '${id}' for instrumentation: ${detail}`);
  }
}

// Built-in patches: always attempted, silently skipped if not present.
prePatch("node:http");
prePatch("node:https");
for (const id of config().prismaClientModuleIds) prePatch(id);

// User-configured library modules: warn if pre-patching fails, since the
// user explicitly asked for instrumentation of these.
for (const pkg of config().packages) {
  if (pkg.module) prePatch(pkg.module, { warnOnFailure: true });
}
