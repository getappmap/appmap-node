import assert from "node:assert";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { inspect } from "node:util";
import { isPromise } from "node:util/types";

import type * as AppMap from "./AppMap";
import AppMapStream from "./AppMapStream";
import { makeClassMap } from "./classMap";
import config from "./config";
import { makeCallEvent, makeExceptionEvent, makeReturnEvent } from "./event";
import { getDefaultMetadata } from "./metadata";
import { parameter } from "./parameter";
import type { FunctionInfo } from "./registry";
import compactObject from "./util/compactObject";
import { getTime, getTimeInMilliseconds } from "./util/getTime";
import { shouldRecord } from "./recorderControl";
import { warn } from "./message";

export default class Recording {
  constructor(type: AppMap.RecorderType, recorder: string, ...names: string[]) {
    const dirs = [recorder, ...names].map(quotePathSegment);
    const name = dirs.pop()!; // it must have at least one element
    this.path = join(config().appmapDir, ...dirs, makeAppMapFilename(name));
    this.partPath = this.path + ".part";
    this.stream = new AppMapStream(this.partPath);
    this.metadata = {
      ...getDefaultMetadata(),
      recorder: { type, name: recorder },
      name: names.join(" "),
    };
  }

  private nextId = 1;
  private functionsSeen = new Set<FunctionInfo>();
  private stream: AppMapStream;
  private partPath: string;
  public readonly path;
  public metadata: AppMap.Metadata;

  functionCall(funInfo: FunctionInfo, thisArg: unknown, args: unknown[]): AppMap.FunctionCallEvent {
    this.functionsSeen.add(funInfo);
    const event = makeCallEvent(this.nextId++, funInfo, thisArg, args);
    this.emit(event);
    return event;
  }

  functionException(
    callId: number,
    exception: unknown,
    startTime?: number,
  ): AppMap.FunctionReturnEvent {
    const elapsed = startTime ? getTime() - startTime : undefined;
    const event = makeExceptionEvent(this.nextId++, callId, exception, elapsed);
    this.emit(event);
    return event;
  }

  functionReturn(callId: number, result: unknown, startTime?: number): AppMap.FunctionReturnEvent {
    const elapsed = startTime ? getTime() - startTime : undefined;
    const event = makeReturnEvent(this.nextId++, callId, result, elapsed);
    if (isPromise(result)) this.fixupPromise(event, result, startTime);
    this.emit(event);
    return event;
  }

  // When there are multiple active recordings this function will be called with different "event"
  // objects for each recording and multiple "then" handlers will be attached to the same "result" promise.
  fixupPromise(event: AppMap.FunctionReturnEvent, result: Promise<unknown>, startTime?: number) {
    result.then(
      () => {
        const elapsed = startTime ? getTime() - startTime : undefined;
        const newReturn = makeReturnEvent(event.id, event.parent_id, result, elapsed);
        this.fixup(newReturn);
      },
      (reason) => {
        const elapsed = startTime ? getTime() - startTime : undefined;
        const exnEvent = makeExceptionEvent(event.id, event.parent_id, reason, elapsed);
        // add return_value too, so it's not unambiguous whether the function
        // threw or returned a promise which then rejected
        exnEvent.return_value = parameter(result);
        this.fixup(exnEvent);
      },
    );
  }

  sqlQuery(databaseType: string, sql: string): AppMap.SqlQueryEvent {
    const event: AppMap.SqlQueryEvent = {
      event: "call",
      sql_query: compactObject({
        database_type: databaseType,
        sql,
      }),
      id: this.nextId++,
      thread_id: 0,
    };
    this.emit(event);
    return event;
  }

  httpClientRequest(
    method: string,
    url: string,
    headers?: Record<string, string>,
  ): AppMap.HttpClientRequestEvent {
    const event: AppMap.HttpClientRequestEvent = {
      event: "call",
      http_client_request: compactObject({
        request_method: method,
        url: url,
        headers: headers,
      }),
      id: this.nextId++,
      thread_id: 0,
    };
    this.emit(event);

    return event;
  }

  httpClientResponse(
    callId: number,
    elapsed: number,
    status: number,
    headers?: Record<string, string>,
    returnValue?: AppMap.Parameter,
  ): AppMap.HttpClientResponseEvent {
    const event: AppMap.HttpClientResponseEvent = {
      event: "return",
      http_client_response: compactObject({
        status_code: status,
        headers,
        return_value: returnValue,
      }),
      id: this.nextId++,
      thread_id: 0,
      parent_id: callId,
      elapsed,
    };
    this.emit(event);

    return event;
  }

  httpRequest(
    method: string,
    path: string,
    protocol?: string,
    headers?: Record<string, string>,
    params?: URLSearchParams,
  ): AppMap.HttpServerRequestEvent {
    const event: AppMap.HttpServerRequestEvent = {
      event: "call",
      http_server_request: compactObject({
        path_info: path,
        request_method: method,
        headers,
        protocol,
      }),
      id: this.nextId++,
      thread_id: 0,
    };
    const query = params && Array.from(params);
    if (query && query.length > 0) {
      event.message = [];
      for (const [name, value] of params) {
        event.message.push({
          name,
          value: inspect(value),
          class: "String",
        });
      }
    }
    this.emit(event);
    return event;
  }

  httpResponse(
    callId: number,
    elapsed: number,
    status: number,
    headers?: Record<string, string>,
    returnValue?: AppMap.Parameter,
  ): AppMap.HttpServerResponseEvent {
    const event: AppMap.HttpServerResponseEvent = {
      event: "return",
      http_server_response: compactObject({
        status_code: status,
        headers,
        return_value: returnValue,
      }),
      id: this.nextId++,
      thread_id: 0,
      parent_id: callId,
      elapsed,
    };
    this.emit(event);

    return event;
  }

  private eventUpdates: Record<number, AppMap.Event> = {};

  fixup(event: AppMap.Event) {
    if (this.bufferedEvents.has(event.id)) {
      const buffered = this.bufferedEvents.get(event.id)!;
      if (event === buffered) return;
      else Object.assign(buffered, event);
    } else this.eventUpdates[event.id] = event;
  }

  abandon(): void {
    if (this.running && this.stream?.close()) rmSync(this.partPath);
    this.running = false;
    this.disposeBufferedEvents(Recording.rootBuffer);
  }

  finish(): boolean {
    if (!this.running) return false;
    this.passEvents(this.stream, Recording.rootBuffer);
    const written = this.stream?.close(
      compactObject({
        classMap: makeClassMap(this.functionsSeen.keys()),
        metadata: compactObject(this.metadata),
        eventUpdates: Object.keys(this.eventUpdates).length > 0 ? this.eventUpdates : undefined,
      }),
    );
    if (written) {
      renameSync(this.partPath, this.path);
      writtenAppMaps.push(this.path);
    }
    this.running = false;
    this.disposeBufferedEvents(Recording.rootBuffer);
    return !!written;
  }

  public running = true;

  private bufferedEvents = new Map<number, AppMap.Event>();

  public emit(event: AppMap.Event) {
    // Check here if we should record instead of requiring each
    // possible hook to check it.
    // This is also checked in recorder.record() to prevent
    // unnecessary event object creation. Checking this inside hooks,
    // (http, sqlite, pg, mysql, ...) will save some CPU cycles but
    // will complicate their code.
    if (!shouldRecord()) return;

    if (!this.running) {
      warn("event emitted while recording not running");
      return;
    }

    if (this.stream == undefined) {
      warn("Event emitted while stream is closed");
      return;
    }

    // If the current buffer is alive more than allowed pass its events
    // to the stream and clear it recursively.
    if (Recording.buffering && !Recording.buffer.disposed && config().asyncTrackingTimeout != 0) {
      const elapsed = getTimeInMilliseconds() - Recording.buffer.createdAt;
      if (elapsed >= config().asyncTrackingTimeout)
        Recording.passEventsAndClearBuffer(Recording.buffer);
    }

    if (Recording.buffering && !Recording.buffer.disposed && config().asyncTrackingTimeout != 0) {
      this.bufferedEvents.set(event.id, event);
      Recording.buffer.items.push({ event, owner: new WeakRef(this) });
    } else this.stream.push(event);
  }

  private static _rootBuffer: EventBuffer | undefined;
  private static get rootBuffer(): EventBuffer {
    Recording._rootBuffer ??= { items: [], disposed: false, createdAt: getTimeInMilliseconds() };

    return Recording._rootBuffer;
  }

  private static asyncStorage = new AsyncLocalStorage<EventBuffer>();

  private static get buffering(): boolean {
    return Recording.rootBuffer.items.length > 0;
  }

  private static get buffer(): EventBuffer {
    return Recording.asyncStorage.getStore() ?? Recording.rootBuffer;
  }

  public static fork<T>(fun: () => T): T {
    const forked: EventBuffer = { items: [], disposed: false, createdAt: getTimeInMilliseconds() };
    Recording.buffer.items.push(forked);

    return Recording.asyncStorage.run(forked, fun);
  }

  public static run(context: EventBuffer | undefined, fun: () => void) {
    if (context) Recording.asyncStorage.run(context, fun);
    else fun();
  }

  public static getContext() {
    return Recording.asyncStorage.getStore();
  }

  private static passEventsAndClearBuffer(buffer: EventBuffer) {
    for (const event of buffer.items) {
      if (isEventBuffer(event)) this.passEventsAndClearBuffer(event);
      else {
        const recording = event?.owner.deref();
        if (event && recording) {
          recording.stream.push(event.event);
          recording.bufferedEvents.delete(event.event.id);
        }
      }
    }
    buffer.disposed = true;
    buffer.items = [];
  }

  readAppMap(): AppMap.AppMap {
    assert(!this.running);
    return JSON.parse(readFileSync(this.path, "utf8")) as AppMap.AppMap;
  }

  private passEvents(stream: AppMapStream, buffer: EventBuffer) {
    for (const event of buffer.items) {
      if (isEventBuffer(event)) this.passEvents(stream, event);
      else if (event?.owner.deref() == this) stream.push(event.event);
    }
  }

  private disposeBufferedEvents(buffer: EventBuffer) {
    for (let i = 0; i < buffer.items.length; i++) {
      const event = buffer.items[i];
      if (isEventBuffer(event)) this.disposeBufferedEvents(event);
      else if (event?.owner.deref() == this) buffer.items[i] = null;
    }
  }
}

function isEventBuffer(obj: EventOrBuffer): obj is EventBuffer {
  return obj != null && "items" in obj;
}

interface EventWithOwner {
  owner: WeakRef<Recording>;
  event: AppMap.Event;
}

type EventOrBuffer = EventWithOwner | null | EventBuffer;
export interface EventBuffer {
  items: EventOrBuffer[];
  disposed: boolean;
  createdAt: number;
}

export const writtenAppMaps: string[] = [];

function makeAppMapFilename(name: string): string {
  // TODO make sure it isn't too long
  return name + ".appmap.json";
}

function quotePathSegment(value: string): string {
  // note replacing spaces isn't strictly necessary but improves UX
  return value.replaceAll(/[/\\:<>*"|?]/g, "-").replaceAll(" ", "_");
}
