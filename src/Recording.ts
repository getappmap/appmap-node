import assert from "node:assert";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setTimeout } from "node:timers";
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
import { info, warn } from "./message";

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
    if (isPromise(result)) {
      // Hold the return event back until the promise settles, so that it's
      // fixed up with the result before it's written out.
      const settled = Recording.hold();
      this.fixupPromise(event, result, startTime);
      result.then(settled, settled);
    }
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

  // Emits the return event of a call whose result comes in later (eg. in a callback)
  // right away, so that it closes the call whatever is recorded in the meantime.
  // Pass it to completeReturn() or completeException() once the call is done.
  pendingReturn(callId: number): AppMap.FunctionReturnEvent {
    const event = makeReturnEvent(this.nextId++, callId, undefined);
    this.emit(event);
    return event;
  }

  completeReturn(event: AppMap.FunctionReturnEvent, startTime: number, result?: unknown) {
    this.fixup(makeReturnEvent(event.id, event.parent_id, result, getTime() - startTime));
  }

  completeException(event: AppMap.FunctionReturnEvent, startTime: number, exception: unknown) {
    this.fixup(makeExceptionEvent(event.id, event.parent_id, exception, getTime() - startTime));
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

  // Both the call and the return event are emitted right away, so that the events
  // nest properly even if requests overlap. The returned event carries no response
  // data yet; pass it to httpClientResponse() once the response arrives.
  httpClientRequest(
    method: string,
    url: string,
    headers?: Record<string, string>,
  ): AppMap.HttpClientResponseEvent {
    const call: AppMap.HttpClientRequestEvent = {
      event: "call",
      http_client_request: compactObject({
        request_method: method,
        url: url,
        headers: headers,
      }),
      id: this.nextId++,
      thread_id: 0,
    };
    this.emit(call);

    const response: AppMap.HttpClientResponseEvent = {
      event: "return",
      id: this.nextId++,
      thread_id: 0,
      parent_id: call.id,
    };
    this.emit(response);

    return response;
  }

  httpClientResponse(
    returnEvent: AppMap.HttpClientResponseEvent,
    elapsed: number,
    status: number,
    headers?: Record<string, string>,
    returnValue?: AppMap.Parameter,
  ): AppMap.HttpClientResponseEvent {
    const event: AppMap.HttpClientResponseEvent = {
      ...returnEvent,
      http_client_response: compactObject({
        status_code: status,
        headers,
        return_value: returnValue,
      }),
      elapsed,
    };
    this.fixup(event);

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

  // Emitted as soon as the request handlers have been dispatched, so that it closes
  // the request call even if the response is ended from a different async context.
  // The returned event carries no response data yet; pass it to httpResponseFinish()
  // once the response is sent.
  httpResponse(callId: number): AppMap.HttpServerResponseEvent {
    const event: AppMap.HttpServerResponseEvent = {
      event: "return",
      id: this.nextId++,
      thread_id: 0,
      parent_id: callId,
    };
    this.emit(event);

    return event;
  }

  httpResponseFinish(
    returnEvent: AppMap.HttpServerResponseEvent,
    elapsed: number,
    status: number,
    headers?: Record<string, string>,
    returnValue?: AppMap.Parameter,
  ): AppMap.HttpServerResponseEvent {
    const event: AppMap.HttpServerResponseEvent = {
      ...returnEvent,
      http_server_response: compactObject({
        status_code: status,
        headers,
        return_value: returnValue,
      }),
      elapsed,
    };
    this.fixup(event);

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

    if (config().asyncTrackingTimeout == 0) {
      this.stream.push(event);
      return;
    }

    const buffer = Recording.buffer;
    if (buffer === Recording.rootBuffer && buffer.items.length == 0) {
      // nothing is held back, so there's nothing to wait for
      this.stream.push(event);
      return;
    }

    this.bufferedEvents.set(event.id, event);
    buffer.items.push({ event, owner: new WeakRef(this) });
    Recording.drain();
  }

  // Events are kept in a tree of buffers mirroring the async calls. Each buffer is
  // forked at the current position of its parent when an async call is made and
  // completed when the call is done (eg. when the returned promise settles).
  // Events are written to the stream in tree order as soon as everything before
  // them has been written and the buffers enclosing them have completed. A buffer
  // that holds up writing for longer than asyncTrackingTimeout is given up on.
  // Events emitted later in the async context of a buffer that has completed or
  // been given up on go to the closest enclosing one which hasn't.
  private static _rootBuffer: EventBuffer | undefined;
  private static get rootBuffer(): EventBuffer {
    Recording._rootBuffer ??= newBuffer();
    return Recording._rootBuffer;
  }

  private static asyncStorage = new AsyncLocalStorage<EventBuffer>();

  private static get buffer(): EventBuffer {
    let buffer = Recording.asyncStorage.getStore() ?? Recording.rootBuffer;
    while (buffer.complete || buffer.disposed) buffer = buffer.parent ?? Recording.rootBuffer;
    return buffer;
  }

  // Runs fun in a new async context, with the events emitted in it placed at the
  // current position. Events emitted afterwards in the current context are held
  // back until complete() is called.
  public static fork<T>(fun: () => T): { result: T; complete: () => void } {
    if (config().asyncTrackingTimeout == 0) return { result: fun(), complete: () => undefined };

    const forked = newBuffer();
    const complete = Recording.insert(forked);

    try {
      return { result: Recording.asyncStorage.run(forked, fun), complete };
    } catch (exn) {
      complete();
      throw exn;
    }
  }

  // Holds back the events emitted from now on in the current async context
  // until the returned function is called.
  public static hold(): () => void {
    if (config().asyncTrackingTimeout == 0) return () => undefined;
    return Recording.insert(newBuffer());
  }

  // Inserts the buffer at the current position, returning a function to complete it.
  private static insert(buffer: EventBuffer): () => void {
    buffer.parent = Recording.buffer;
    buffer.parent.items.push(buffer);
    return () => {
      buffer.complete = true;
      Recording.drain();
    };
  }

  // Reserves the current position for events emitted later in the returned
  // context, eg. the return event of a call whose result comes in a callback.
  // Events emitted afterwards in the current context are held back until the
  // reservation is completed.
  public static reserve(): { context: EventBuffer | undefined; complete: () => void } {
    const { result: context, complete } = Recording.fork(() => Recording.getContext());
    return { context, complete };
  }

  public static run<T>(context: EventBuffer | undefined, fun: () => T): T {
    return context ? Recording.asyncStorage.run(context, fun) : fun();
  }

  public static getContext() {
    return Recording.asyncStorage.getStore();
  }

  // Writes out the events of the buffer, and of the buffers nested in it, in order,
  // stopping at the first incomplete one. Returns whether it got through all of
  // it. Buffers which have been written out completely are disposed of.
  private static drainBuffer(buffer: EventBuffer): boolean {
    const { items } = buffer;
    while (buffer.next < items.length) {
      const item = items[buffer.next];
      if (!isEventBuffer(item)) passEvent(item);
      else if (!Recording.drainBuffer(item)) break;
      items[buffer.next++] = null;
    }

    if (buffer.next == items.length) {
      items.length = 0;
      buffer.next = 0;
      if (!(buffer.complete || buffer.disposed)) return false;
      buffer.disposed = true;
      return true;
    }

    // Removing what's been written each time would take quadratic time with many
    // items, eg. sibling async calls completing one by one, so do it in bulk.
    if (buffer.next >= 1024 && buffer.next * 2 >= items.length) {
      items.splice(0, buffer.next);
      buffer.next = 0;
    }
    return false;
  }

  // Writes out the events of the buffer and of the buffers nested in it, complete
  // or not, and disposes of them.
  private static flushBuffer(buffer: EventBuffer) {
    for (const item of buffer.items)
      if (isEventBuffer(item)) Recording.flushBuffer(item);
      else passEvent(item);
    buffer.items = [];
    buffer.next = 0;
    buffer.disposed = true;
  }

  // The outermost buffer holding up writing, ie. the one written out the least
  // recently. Buffers nested in it are younger and can't be done any earlier.
  private static get blocker(): EventBuffer | undefined {
    const { items, next } = Recording.rootBuffer;
    const first = items[next];
    return isEventBuffer(first) ? first : undefined;
  }

  // only to be called while draining the buffers
  passEvent(event: AppMap.Event) {
    if (!this.running) return;
    this.stream.push(event);
    this.bufferedEvents.delete(event.id);
  }

  private static giveUpTimer: NodeJS.Timeout | undefined;

  private static drain() {
    Recording.drainBuffer(Recording.rootBuffer);
    const blocker = Recording.blocker;
    if (!blocker || Recording.giveUpTimer) return;

    // Check again once the blocker is overdue (or right after the synchronous code
    // currently running if it already is, so that no call is split from its
    // return), even if nothing else happens until then.
    const delay = blocker.createdAt + config().asyncTrackingTimeout - getTimeInMilliseconds();
    Recording.giveUpTimer = setTimeout(() => Recording.giveUp(), Math.max(delay, 0)).unref();
  }

  private static giveUp() {
    Recording.giveUpTimer = undefined;
    let blocker;
    while ((blocker = Recording.blocker) && isOverdue(blocker)) {
      Recording.reportGivingUp();
      Recording.flushBuffer(blocker);
      Recording.drainBuffer(Recording.rootBuffer);
    }
    Recording.drain();
  }

  private static reportedGivingUp = false;

  private static reportGivingUp() {
    if (Recording.reportedGivingUp) return;
    Recording.reportedGivingUp = true;
    info(
      "An async call took longer than %d ms, so whatever it does from now on will be " +
        "recorded outside of it. To wait longer, set async_tracking_timeout in appmap.yml " +
        "or APPMAP_ASYNC_TRACKING_TIMEOUT (in milliseconds).",
      config().asyncTrackingTimeout,
    );
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

function passEvent(item: EventWithOwner | null) {
  item?.owner.deref()?.passEvent(item.event);
}

function isOverdue(buffer: EventBuffer) {
  return getTimeInMilliseconds() - buffer.createdAt >= config().asyncTrackingTimeout;
}

function newBuffer(): EventBuffer {
  return {
    items: [],
    next: 0,
    disposed: false,
    complete: false,
    createdAt: getTimeInMilliseconds(),
  };
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
  // the ones before next have been written out (and nulled)
  items: EventOrBuffer[];
  next: number;
  // no more events will be added, except in nested buffers
  complete: boolean;
  // no longer part of the tree, see Recording.buffer
  disposed: boolean;
  createdAt: number;
  parent?: EventBuffer;
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
