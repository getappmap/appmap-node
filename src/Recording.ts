import assert from "node:assert";
import { rmSync } from "node:fs";
import { join } from "node:path";

import type AppMap from "./AppMap";
import AppMapStream from "./AppMapStream";
import { appMapDir } from "./config";
import { makeCallEvent, makeReturnEvent } from "./event";
import type { FunctionInfo } from "./registry";
import { makeClassMap } from "./classMap";
import { defaultMetadata } from "./metadata";

export default class Recording {
  constructor(type: AppMap.RecorderType, recorder: string, ...names: string[]) {
    const dirs = [recorder, ...names];
    const name = dirs.pop()!; // it must have at least one element
    this.path = join(appMapDir, ...dirs, makeAppMapFilename(name));
    this.stream = new AppMapStream(this.path);
    this.metadata = {
      ...defaultMetadata,
      recorder: { type, name: recorder },
      name: names.join(" "),
    };
  }

  private nextId = 1;
  private functionsSeen = new Set<FunctionInfo>();
  private stream: AppMapStream | undefined;
  public readonly path;
  public metadata: AppMap.Metadata;

  functionCall(funInfo: FunctionInfo, thisArg: unknown, args: unknown[]): AppMap.FunctionCallEvent {
    assert(this.stream);
    this.functionsSeen.add(funInfo);
    const event = makeCallEvent(this.nextId++, funInfo, thisArg, args);
    this.stream.emit(event);
    return event;
  }

  functionReturn(callId: number, result: unknown, elapsed?: number): AppMap.FunctionReturnEvent {
    assert(this.stream);
    const event = makeReturnEvent(this.nextId++, callId, result, elapsed);
    this.stream.emit(event);
    return event;
  }

  abandon(): void {
    if (this.stream?.close()) rmSync(this.path);
    this.stream = undefined;
  }

  finish(): boolean {
    const written = this.stream?.close({
      classMap: makeClassMap(this.functionsSeen.keys()),
      metadata: this.metadata,
    });
    this.stream = undefined;
    if (written) writtenAppMaps.push(this.path);
    return !!written;
  }

  get running(): boolean {
    return !!this.stream;
  }
}

export const writtenAppMaps: string[] = [];

function makeAppMapFilename(name: string): string {
  // TODO make sure it isn't too long
  return name + ".appmap.json";
}
