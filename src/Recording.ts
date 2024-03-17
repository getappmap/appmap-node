import { AsyncLocalStorage } from "node:async_hooks";
import { renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { inspect } from "node:util";
import { isPromise } from "node:util/types";

import type AppMap from "./AppMap";
import AppMapStream from "./AppMapStream";
import { makeClassMap } from "./classMap";
import config from "./config";
import { makeCallEvent, makeExceptionEvent, makeReturnEvent } from "./event";
import { defaultMetadata } from "./metadata";
import { parameter } from "./parameter";
import type { FunctionInfo } from "./registry";
import compactObject from "./util/compactObject";
import { getTime } from "./util/getTime";
import { warn } from "./message";

export default class Recording {
  constructor(type: AppMap.RecorderType, recorder: string, ...names: string[]) {
    const dirs = [recorder, ...names].map(quotePathSegment);
    const name = dirs.pop()!; // it must have at least one element
    this.path = join(config.appmapDir, ...dirs, makeAppMapFilename(name));
    this.partPath = this.path + ".part";
    this.stream = new AppMapStream(this.partPath);
    this.metadata = {
      ...defaultMetadata,
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
  }

  finish(): boolean {
    if (!this.running) return false;
    passEvents(this.stream, this.rootBuffer);
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
    return !!written;
  }

  public running = true;

  private bufferedEvents = new Map<number, AppMap.Event>();

  public emit(event: AppMap.Event) {
    if (!this.running) {
      warn("event emitted while recording not running");
      return;
    }
    if (this.buffering) {
      this.bufferedEvents.set(event.id, event);
      this.buffer.push(event);
    } else this.stream.push(event);
  }

  private rootBuffer: EventBuffer = [];
  private localBuffer = new AsyncLocalStorage<EventBuffer>();

  private get buffering(): boolean {
    return this.rootBuffer.length > 0;
  }

  private get buffer(): EventBuffer {
    return this.localBuffer.getStore() ?? this.rootBuffer;
  }

  public fork<T>(fun: () => T): T {
    const forked: EventBuffer = [];
    this.buffer.push(forked);
    return this.localBuffer.run(forked, fun);
  }
}

function passEvents(stream: AppMapStream, buffer: EventBuffer) {
  for (const event of buffer) {
    if (Array.isArray(event)) passEvents(stream, event);
    else stream.push(event);
  }
}

type EventOrBuffer = AppMap.Event | EventBuffer;
type EventBuffer = EventOrBuffer[];

export const writtenAppMaps: string[] = [];

function makeAppMapFilename(name: string): string {
  // TODO make sure it isn't too long
  return name + ".appmap.json";
}

const charsToQuote = process.platform == "win32" ? /[/\\:<>*"|?]/g : /[/\\]/g;
function quotePathSegment(value: string): string {
  // note replacing spaces isn't strictly necessary improves UX
  return value.replaceAll(charsToQuote, "-").replaceAll(" ", "_");
}
