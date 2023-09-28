import assert from "node:assert";

import { info } from "./message";
import { functions } from "./registry";
import Recording, { writtenAppMaps } from "./Recording";
import commonPathPrefix from "./util/commonPathPrefix";

export let recording: Recording = new Recording("process", new Date().toISOString());

export function record<This, Return>(
  this: This,
  fun: (this: This, ...args: unknown[]) => Return,
  args: unknown[],
  functionIdx: number,
): Return {
  if (!recording.running) return fun.apply(this, args);

  const funInfo = functions[functionIdx];
  const call = recording.functionCall(funInfo, isGlobal(this) ? undefined : this, [...args]);

  // TODO handle exceptions
  const result = fun.apply(this, args);

  recording.functionReturn(call.id, result);

  return result;
}

/* Detect a global-ish object, perhaps coming from a different context.
This is a bit of a heuristic, but we can't rely on obj === global since
the obj could be coming from somewhere else (eg. in a test it would
be the test context). */
function isGlobal(obj: unknown): obj is typeof globalThis {
  return typeof obj === "object" && obj !== null && "global" in obj && obj.global === obj;
}

export function start(type: string, ...names: string[]) {
  assert(!recording.running);
  recording = new Recording(type, ...names);
}

process.on("exit", () => {
  recording.finish();
  if (writtenAppMaps.length === 1) info("Wrote %s", writtenAppMaps[0]);
  else if (writtenAppMaps.length > 1)
    info("Wrote %d AppMaps to %s", writtenAppMaps.length, commonPathPrefix(writtenAppMaps));
});
