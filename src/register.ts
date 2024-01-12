import Module from "node:module";
import { pathToFileURL } from "node:url";
import worker from "node:worker_threads";

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

Module.prototype.require = new Proxy(Module.prototype.require, {
  apply: requireHook,
});

declare global {
  // eslint-disable-next-line no-var
  var AppMapRecordHook: typeof record;
}
global.AppMapRecordHook = record;

// A side channel to allow requiring a module when requested from
// the loader. This is a bit of a hack to allow patching modules like
// http and https in ESM; import hooks don't have a way to modify
// the module after it's loaded (like require hooks), but they share
// module cache for the built-in modules. By catching an import
// and requiring it before the import happens we pre-populate the
// cache with our patched version.
export function forceRequire(specifier: string): void {
  cjsRequire(specifier);
  // We also broadcast to other threads so it works when the
  // loader is in a separate thread (as in newer nodes) with
  // a separate module cache.
  esmRequireChannel.postMessage(specifier);
}

const cjsRequire = Module.createRequire(__filename);
const esmRequireChannel = new worker.BroadcastChannel("appmap-node/register/esm-require").unref();

esmRequireChannel.onmessage = (message: unknown) => {
  if (
    !(
      message != null &&
      typeof message == "object" &&
      "data" in message &&
      typeof message.data == "string"
    )
  )
    return;
  cjsRequire(message.data);
};
