import assert from "node:assert";
import { isPromise } from "node:util/types";

import type * as AppMap from "./AppMap";
import Recording, { writtenAppMaps } from "./Recording";
import { makeExceptionEvent, makeReturnEvent } from "./event";
import { info } from "./message";
import { getClass, objectId } from "./parameter";
import { shouldRecord } from "./recorderControl";
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
  if (!recording.running || !shouldRecord()) return fun.apply(this, args);

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
    return result.then(
      (value) => {
        const newReturn = makeReturnEvent(
          returnEvent.id,
          callEvent.id,
          result,
          getTime() - startTime,
        );
        newReturn.return_value!.class = `Promise<${getClass(value)}>`;
        recording.fixup(newReturn);
        return result;
      },
      (reason) => {
        const event = makeExceptionEvent(
          returnEvent.id,
          callEvent.id,
          reason,
          getTime() - startTime,
        );
        // add return_value too, so it's not unambiguous whether the function
        // threw or returned a promise which then rejected
        event.return_value = {
          class: "Promise",
          // don't repeat the exception info
          value: "Promise { <rejected> }",
          object_id: objectId(result),
        };
        recording.fixup(event);
        return result;
      },
    );

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
