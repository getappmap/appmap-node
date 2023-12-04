import assert from "node:assert";
import { isPromise } from "node:util/types";

import AppMap from "./AppMap";
import Recording, { writtenAppMaps } from "./Recording";
import { makeReturnEvent } from "./event";
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
    const ret = recording.functionReturn(call.id, result, getTime() - start);
    return fixReturnEventIfPromiseResult(result, ret, call, start) as Return;
  } catch (exn: unknown) {
    recording.functionException(call.id, exn, getTime() - start);
    throw exn;
  }
}

export function fixReturnEventIfPromiseResult(
  result: unknown,
  returnEvent: AppMap.FunctionReturnEvent,
  callEvent: AppMap.CallEvent,
  startTime: number,
) {
  if (isPromise(result) && returnEvent.return_value?.value.includes("<pending>"))
    return result.then(() => {
      recording.fixup(makeReturnEvent(returnEvent.id, callEvent.id, result, getTime() - startTime));
      return result;
    });

  return result;
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

process.on("exit", () => {
  recording.finish();
  if (writtenAppMaps.length === 1) info("Wrote %s", writtenAppMaps[0]);
  else if (writtenAppMaps.length > 1)
    info("Wrote %d AppMaps to %s", writtenAppMaps.length, commonPathPrefix(writtenAppMaps));
});
