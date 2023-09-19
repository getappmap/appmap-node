import { join } from "node:path";
import { cwd } from "node:process";

import AppMapStream from "./AppMapStream";
import { FunctionInfo, functions } from "./registry";
import { info } from "./message";
import { rmSync } from "node:fs";
import { makeClassMap } from "./classMap";

interface CallEvent {
  type: "call";
  fun: FunctionInfo;
  this_?: unknown;
  args: unknown[];
}

interface ReturnEvent {
  type: "return";
  parent_id: number;
  return_value?: unknown;
}

export type Event = { id: number } & (CallEvent | ReturnEvent);

let currentId = 1;

let stream: AppMapStream | undefined;
const functionsSeen = new Set<FunctionInfo>();

export function record<This, Return>(
  this: This,
  fun: (this: This, ...args: unknown[]) => Return,
  args: unknown[],
  functionIdx: number,
): Return {
  const funInfo = functions[functionIdx];
  functionsSeen.add(funInfo);
  const call: Event = {
    type: "call",
    fun: funInfo,
    args: [...args],
    id: currentId++,
  };

  if (!isGlobal(this)) call.this_ = this;

  emit(call);

  // TODO handle exceptions
  const result = fun.apply(this, args);

  emit({
    type: "return",
    parent_id: call.id,
    return_value: result,
    id: currentId++,
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

export function finishRecording(keep = true) {
  if (stream?.close({ classMap: makeClassMap(functionsSeen.keys()) })) {
    if (keep) info("Wrote %s", stream.path);
    else rmSync(stream.path);
  }
  stream = undefined;
  currentId = 1;
  functionsSeen.clear();
}

process.on("exit", () => finishRecording(true));

function emit(event: Event) {
  stream?.emitEvent(event);
}

const root = cwd();

export function start(type: string, ...names: string[]) {
  const dirs = [type, ...names];
  const name = dirs.pop()!; // it must have at least one element

  stream = new AppMapStream(join(root, "tmp", "appmap", ...dirs, makeAppMapFilename(name)));
}

function makeAppMapFilename(name: string): string {
  // TODO make sure it isn't too long
  return name + ".appmap.json";
}

function timestampName(): string {
  return new Date().toISOString();
}

start("process", timestampName());
