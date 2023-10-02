import assert from "node:assert";
import { hrtime } from "node:process";

import { info } from "./message";
import { functions } from "./registry";
import Recording, { writtenAppMaps } from "./Recording";
import commonPathPrefix from "./util/commonPathPrefix";

export let recording: Recording = new Recording("process", "process", new Date().toISOString());

export function record<This, Return>(
  this: This,
  fun: (this: This, ...args: unknown[]) => Return,
  args: unknown[],
  functionIdx: number,
): Return {
  if (!recording.running) return fun.apply(this, args);

  const funInfo = functions[functionIdx];
  const call = recording.functionCall(funInfo, isGlobal(this) ? undefined : this, [...args]);

  const start = getTime();
  // TODO handle exceptions
  const result = fun.apply(this, args);

  recording.functionReturn(call.id, result, getTime() - start);

  return result;
}

/* Detect a global-ish object, perhaps coming from a different context.
This is a bit of a heuristic, but we can't rely on obj === global since
the obj could be coming from somewhere else (eg. in a test it would
be the test context). */
function isGlobal(obj: unknown): obj is typeof globalThis {
  return typeof obj === "object" && obj !== null && "global" in obj && obj.global === obj;
}

export function start(newRecording: Recording) {
  assert(!recording.running);
  recording = newRecording;
}

process.on("exit", () => {
  recording.finish();
  if (writtenAppMaps.length === 1) info("Wrote %s", writtenAppMaps[0]);
  else if (writtenAppMaps.length > 1)
    info("Wrote %d AppMaps to %s", writtenAppMaps.length, commonPathPrefix(writtenAppMaps));
});

function getTime(): number {
  const [sec, nano] = hrtime();
  return sec + nano / 1_000_000_000;
}
