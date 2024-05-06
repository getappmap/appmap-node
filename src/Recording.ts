import assert from "node:assert";
import { readFileSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { inspect } from "node:util";

import type * as AppMap from "./AppMap";
import AppMapStream from "./AppMapStream";
import { makeClassMap } from "./classMap";
import config from "./config";
import { makeCallEvent, makeExceptionEvent, makeReturnEvent } from "./event";
import { getDefaultMetadata } from "./metadata";
import type { FunctionInfo } from "./registry";
import compactObject from "./util/compactObject";
import { shouldRecord } from "./recorderControl";

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
  private stream: AppMapStream | undefined;
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
    elapsed?: number,
  ): AppMap.FunctionReturnEvent {
    const event = makeExceptionEvent(this.nextId++, callId, exception, elapsed);
    this.emit(event);
    return event;
  }

  functionReturn(callId: number, result: unknown, elapsed?: number): AppMap.FunctionReturnEvent {
    const event = makeReturnEvent(this.nextId++, callId, result, elapsed);
    this.emit(event);
    return event;
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

  private emit(event: unknown) {
    // Check here if we should record instead of requiring each
    // possible hook to check it.
    // This is also checked in recorder.record() to prevent
    // unnecessary event object creation. Checking this inside hooks,
    // (http, sqlite, pg, mysql, ...) will save some CPU cycles but
    // will complicate their code.
    if (!shouldRecord()) return;
    assert(this.stream);
    this.stream.emit(event);
  }

  private eventUpdates: Record<number, AppMap.Event> = {};

  fixup(event: AppMap.Event) {
    this.eventUpdates[event.id] = event;
  }

  abandon(): void {
    if (this.stream?.close()) rmSync(this.partPath);
    this.stream = undefined;
  }

  finish(): boolean {
    const written = this.stream?.close(
      compactObject({
        classMap: makeClassMap(this.functionsSeen.keys()),
        metadata: compactObject(this.metadata),
        eventUpdates: Object.keys(this.eventUpdates).length > 0 ? this.eventUpdates : undefined,
      }),
    );
    this.stream = undefined;
    if (written) {
      renameSync(this.partPath, this.path);
      writtenAppMaps.push(this.path);
    }
    return !!written;
  }

  get running(): boolean {
    return !!this.stream;
  }

  readAppMap(): AppMap.AppMap {
    assert(!this.running);
    return JSON.parse(readFileSync(this.path, "utf8")) as AppMap.AppMap;
  }
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
