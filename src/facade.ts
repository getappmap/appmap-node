import { isPromise } from "node:util/types";

import type * as AppMap from "./AppMap";
import { exceptionMetadata } from "./metadata";

import { getActiveRecordings, getCodeBlockRecording, startCodeBlockRecording } from "./recorder";
import {
  disableGlobalRecording,
  setCodeBlockRecordingActive,
  unsetCodeBlockRecordingActive,
} from "./recorderControl";

// Since _this_ module is loaded, we'll do code block recording only.
// We ignore APPMAP_RECORDER_PROCESS_ALWAYS environment variable in this mode.
getActiveRecordings().forEach((r) => r.abandon());
disableGlobalRecording();

function isInstrumented() {
  return "AppMapRecordHook" in global;
}

type NotPromise<T> = T extends Promise<unknown> ? never : T;

export function record<T>(block: () => NotPromise<T>): AppMap.AppMap | undefined;
export function record<T>(block: () => Promise<T>): Promise<AppMap.AppMap | undefined>;

export function record(
  block: () => unknown,
): AppMap.AppMap | Promise<AppMap.AppMap | undefined> | undefined {
  if (!isInstrumented())
    throw Error("Code is not instrumented. Please run the project with appmap-node.");

  startCodeBlockRecording();
  setCodeBlockRecordingActive();
  try {
    const result = block();
    if (isPromise(result)) return result.then(() => finishRecording(), finishRecording);
  } catch (exn) {
    return finishRecording(exn);
  }
  return finishRecording();
}

function finishRecording(exn?: unknown): AppMap.AppMap | undefined {
  unsetCodeBlockRecordingActive();
  const recording = getCodeBlockRecording();
  if (!recording.finish()) return;

  const appmap = recording.readAppMap();
  if (exn && appmap.metadata) appmap.metadata.exception = exceptionMetadata(exn);
  return appmap;
}

export * as AppMap from "./AppMap";
