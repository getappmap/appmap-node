import assert from "node:assert";
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

export function createEsmRequireChannel() {
  return new worker.BroadcastChannel("appmap-node/register/esm-require");
}

function listenForEsmRequires() {
  const esmRequireChannel = createEsmRequireChannel();
  esmRequireChannel.onmessage = (message: unknown) => {
    assert(
      message != null &&
        typeof message == "object" &&
        "data" in message &&
        typeof message.data == "string",
    );
    Module.createRequire(__filename)(message.data);
  };
  // Allow thread to exit if this is the only handle left
  esmRequireChannel.unref();
}

listenForEsmRequires();
