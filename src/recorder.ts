import assert from "node:assert";

import type * as AppMap from "./AppMap";
import config from "./config";
import Recording, { writtenAppMaps } from "./Recording";
import { info } from "./message";
import { Package } from "./PackageMatcher";
import { shouldRecord } from "./recorderControl";
import { FunctionInfo } from "./registry";
import commonPathPrefix from "./util/commonPathPrefix";
import { getTime } from "./util/getTime";

const kAppmapRecorderProcessAlwaysEnvar = "APPMAP_RECORDER_PROCESS_ALWAYS";
const processRecordingShouldAlwaysBeActive = isTruthy(
  process.env[kAppmapRecorderProcessAlwaysEnvar],
);

function isTruthy(value?: string): boolean {
  if (value == undefined) return false;
  const truthyValues = ["true", "1", "on", "yes"];
  return truthyValues.includes(value.toLowerCase().trim());
}

// If APPMAP_RECORDER_PROCESS_ALWAYS is set we can have
// two recordings active simultaneously. Always active
// one for process recording and one for the others
// (request, test, remote) when needed.
let processRecording: Recording;
let nonProcessRecording: Recording;

export function isActive(recording: Recording) {
  return (
    recording?.running && (processRecording === recording || nonProcessRecording === recording)
  );
}

export function getActiveRecordings() {
  const result = [];
  if (processRecording?.running) result.push(processRecording);
  if (nonProcessRecording?.running) result.push(nonProcessRecording);
  return result;
}

const funToPackage = new WeakMap<FunctionInfo, Package | undefined>();

function getPackage(funInfo: FunctionInfo, isLibrary: boolean) {
  if (!funToPackage.has(funInfo))
    funToPackage.set(funInfo, config().getPackage(funInfo.location?.path, isLibrary));
  return funToPackage.get(funInfo);
}

const recordCallPackageStack: (Package | undefined)[] = [];

function shallowModeSkip(pkg: Package | undefined) {
  // If we have the same package as an immediate parent
  // we should skip recording in shallow mode.
  return (
    pkg?.shallow &&
    recordCallPackageStack.length > 0 &&
    recordCallPackageStack[recordCallPackageStack.length - 1] == pkg
  );
}

export function record<This, Return>(
  this: This,
  fun: (this: This, ...args: unknown[]) => Return,
  args: unknown[],
  funInfo: FunctionInfo,
  isLibrary = false,
): Return {
  const recordings = getActiveRecordings();
  let pkg;
  if (
    recordings.length == 0 ||
    !shouldRecord() ||
    shallowModeSkip((pkg = getPackage(funInfo, isLibrary)))
  )
    return fun.apply(this, args);

  recordCallPackageStack.push(pkg);

  const thisArg = isGlobal(this) || isNullPrototype(this) ? undefined : this;
  const callEvents = recordings.map((r) => r.functionCall(funInfo, thisArg, [...args]));

  const startTime = getTime();
  try {
    const result = Recording.fork(() => fun.apply(this, args));
    recordings.forEach((recording, idx) =>
      recording.functionReturn(callEvents[idx].id, result, startTime),
    );
    return result;
  } catch (exn: unknown) {
    recordings.forEach((recording, idx) =>
      recording.functionException(callEvents[idx].id, exn, startTime),
    );
    throw exn;
  } finally {
    recordCallPackageStack.pop();
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

export function abandonProcessRecordingIfNotAlwaysActive() {
  if (!processRecordingShouldAlwaysBeActive) processRecording?.abandon();
}

export function startProcessRecording() {
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
