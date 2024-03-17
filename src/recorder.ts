import assert from "node:assert";

import Recording, { writtenAppMaps } from "./Recording";
import { info } from "./message";
import { recorderPaused } from "./recorderPause";
import { FunctionInfo } from "./registry";
import commonPathPrefix from "./util/commonPathPrefix";
import { getTime } from "./util/getTime";

export let recording: Recording;

export function record<This, Return>(
  this: This,
  fun: (this: This, ...args: unknown[]) => Return,
  args: unknown[],
  funInfo: FunctionInfo,
): Return {
  if (!recording.running || recorderPaused()) return fun.apply(this, args);

  const call = recording.functionCall(
    funInfo,
    isGlobal(this) || isNullPrototype(this) ? undefined : this,
    [...args],
  );

  const start = getTime();

  try {
    const result = fun.apply(this, args);
    recording.functionReturn(call.id, result, start);
    return result;
  } catch (exn: unknown) {
    recording.functionException(call.id, exn, start);
    throw exn;
  }
}

/* Detect a global-ish object, perhaps coming from a different context.
This is a bit of a heuristic, but we can't rely on obj === global since
the obj could be coming from somewhere else (eg. in a test it would
be the test context). */
function isGlobal(obj: unknown): obj is typeof globalThis {
  return typeof obj === "object" && obj !== null && "global" in obj && obj.global === obj;
}

function isNullPrototype(obj: unknown) {
  return obj != null && Object.getPrototypeOf(obj) === null;
}

export function start(
  newRecording: Recording = new Recording("process", "process", new Date().toISOString()),
) {
  assert(!recording?.running);
  recording = newRecording;
}

start();

function finishRecording() {
  recording.finish();
  if (writtenAppMaps.length === 1) info("Wrote %s", writtenAppMaps[0]);
  else if (writtenAppMaps.length > 1)
    info("Wrote %d AppMaps to %s", writtenAppMaps.length, commonPathPrefix(writtenAppMaps));
}

process.on("exit", finishRecording);

const finishSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
finishSignals.forEach(registerFinishSignalHandler);

function registerFinishSignalHandler(signal: NodeJS.Signals) {
  // Don't register ours if there are handlers already
  if (process.listeners(signal).length > 0) return;

  const handler = () => {
    finishRecording();
    process.kill(process.pid, signal);
  };

  process.once(signal, handler);

  process.on("newListener", (eventName) => {
    // Remove our handler if any other gets installed
    if (eventName == signal) setImmediate(() => process.off(signal, handler));
  });
}
