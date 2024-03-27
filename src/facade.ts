import { isPromise } from "node:util/types";

import type * as AppMap from "./AppMap";
import { exceptionMetadata } from "./metadata";

import { recording, start } from "./recorder";
import {
  disableGlobalRecording,
  startCodeBlockRecording,
  stopCodeBlockRecording,
} from "./recorderControl";
import Recording from "./Recording";

// Since _this_ module is loaded, we'll do code block recording only.
recording.abandon();
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

  start(new Recording("block", "block", new Date().toISOString()));
  startCodeBlockRecording();
  try {
    const result = block();
    if (isPromise(result)) return result.then(() => finishRecording(), finishRecording);
  } catch (exn) {
    return finishRecording(exn);
  }
  return finishRecording();
}

function finishRecording(exn?: unknown): AppMap.AppMap | undefined {
  stopCodeBlockRecording();
  if (!recording.finish()) return;

  const appmap = recording.readAppMap();
  if (exn && appmap.metadata) appmap.metadata.exception = exceptionMetadata(exn);
  return appmap;
}

export * as AppMap from "./AppMap";
