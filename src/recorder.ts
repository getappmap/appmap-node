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

const processRecordingShouldAlwaysBeActive = "APPMAP_RECORDER_PROCESS_ALWAYS" in process.env;

// If APPMAP_RECORDER_PROCESS_ALWAYS is set we can have
// two recordings active simultaneously. Always active
// one for process recording and one for the others
// (request, test, remote) when needed.
let processRecording: Recording;
let nonProcessRecording: Recording;

export function getActiveRecordings() {
  const result = [];
  if (processRecording?.running) result.push(processRecording);
  if (nonProcessRecording?.running) result.push(nonProcessRecording);
  return result;
}

export function record<This, Return>(
  this: This,
  fun: (this: This, ...args: unknown[]) => Return,
  args: unknown[],
  funInfo: FunctionInfo,
): Return {
  const recordings = getActiveRecordings();
  if (recordings.length == 0 || !shouldRecord()) return fun.apply(this, args);

  const thisArg = isGlobal(this) || isNullPrototype(this) ? undefined : this;
  const callEvents = recordings.map((r) => r.functionCall(funInfo, thisArg, [...args]));

  const startTime = getTime();
  try {
    const result = fun.apply(this, args);

    const elapsed = getTime() - startTime;
    const returnEvents = recordings.map((recording, idx) =>
      recording.functionReturn(callEvents[idx].id, result, elapsed),
    );
    return fixReturnEventsIfPromiseResult(
      recordings,
      result,
      returnEvents,
      callEvents,
      startTime,
    ) as Return;
  } catch (exn: unknown) {
    const elapsed = getTime() - startTime;
    recordings.map((recording, idx) =>
      recording.functionException(callEvents[idx].id, exn, elapsed),
    );
    throw exn;
  }
}

export function fixReturnEventsIfPromiseResult(
  recordings: Recording[],
  result: unknown,
  returnEvents: AppMap.FunctionReturnEvent[],
  callEvents: AppMap.CallEvent[],
  startTime: number,
) {
  // returnEvents would have the same return_value, in case of multiple recordings.
  if (isPromise(result) && returnEvents[0].return_value?.value.includes("<pending>"))
    return result.then(
      (value) => {
        const elapsed = getTime() - startTime;
        const promiseClass = `Promise<${getClass(value)}>`;
        recordings.map((recording, idx) => {
          const newReturn = makeReturnEvent(
            returnEvents[idx].id,
            callEvents[idx].id,
            result,
            elapsed,
          );
          newReturn.return_value!.class = promiseClass;
          recording.fixup(newReturn);
        });
        return result;
      },
      (reason) => {
        const elapsed = getTime() - startTime;
        recordings.map((recording, idx) => {
          const event = makeExceptionEvent(
            returnEvents[idx].id,
            callEvents[idx].id,
            reason,
            elapsed,
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
        });

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

export function abandonProcessRecordingIfNotAlwaysActive() {
  if (!processRecordingShouldAlwaysBeActive) processRecording?.abandon();
}

export function startProcessRecording() {
  if (!processRecordingShouldAlwaysBeActive) assert(!processRecording?.running);
  if (!processRecording?.running)
    processRecording = new Recording("process", "process", new Date().toISOString());
}

export function startTestRecording(recorder: string, ...names: string[]): Recording {
  abandonProcessRecordingIfNotAlwaysActive();
  nonProcessRecording?.abandon();
  return (nonProcessRecording = new Recording("tests", recorder, ...names));
}

export function startRemoteRecording() {
  info("Remote recording started");

  abandonProcessRecordingIfNotAlwaysActive();

  nonProcessRecording?.abandon();
  nonProcessRecording = new Recording("remote", "remote", new Date().toISOString());
}

export function startRequestRecording(pathname: string): string {
  abandonProcessRecordingIfNotAlwaysActive();

  const timestamp = new Date().toISOString();
  nonProcessRecording?.abandon();
  nonProcessRecording = new Recording("requests", "requests", [timestamp, pathname].join(" "));
  return timestamp;
}

export function startCodeBlockRecording() {
  nonProcessRecording = new Recording("block", "block", new Date().toISOString());
}

export const getTestRecording = () => getNonProcessRecording("tests");
export const getRequestRecording = () => getNonProcessRecording("requests");
export const getRemoteRecording = () => getNonProcessRecording("remote");
export const getCodeBlockRecording = () => getNonProcessRecording("block");

function getNonProcessRecording(type: AppMap.RecorderType) {
  assert(nonProcessRecording?.metadata.recorder.type == type);
  return nonProcessRecording;
}

startProcessRecording();

function finishRecordings() {
  getActiveRecordings().forEach((r) => r.finish());

  if (writtenAppMaps.length === 1) info("Wrote %s", writtenAppMaps[0]);
  else if (writtenAppMaps.length > 1)
    info("Wrote %d AppMaps to %s", writtenAppMaps.length, commonPathPrefix(writtenAppMaps));
}

process.on("exit", finishRecordings);

const finishSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
finishSignals.forEach(registerFinishSignalHandler);

function registerFinishSignalHandler(signal: NodeJS.Signals) {
  // Don't register ours if there are handlers already
  if (process.listeners(signal).length > 0) return;

  const handler = () => {
    finishRecordings();
    process.kill(process.pid, signal);
  };

  process.once(signal, handler);

  process.on("newListener", (eventName) => {
    // Remove our handler if any other gets installed
    if (eventName == signal) setImmediate(() => process.off(signal, handler));
  });
}
