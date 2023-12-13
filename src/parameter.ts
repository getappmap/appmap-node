import { IncomingMessage, ServerResponse } from "node:http";
import { format, inspect, isDeepStrictEqual } from "node:util";

import type AppMap from "./AppMap";
import { pauseRecorder, resumeRecorder } from "./recorderPause";
import compactObject from "./util/compactObject";

export function parameter(value: unknown): AppMap.Parameter {
  const schema: AppMap.ParameterSchema = parameterSchema(value);

  return compactObject({
    ...schema,
    value: stringify(value),
    size: value instanceof Array ? value.length : undefined,
    object_id: typeof value === "object" ? objectId(value) : undefined,
  });
}

export function stringify(value: unknown): string {
  if (value instanceof IncomingMessage)
    return format("[IncomingMessage: %s %s]", value.method, value.url);
  if (value instanceof ServerResponse)
    return format(
      "[ServerResponse: %s]",
      [value.statusCode, value.statusMessage].filter(Boolean).join(" "),
    );
  // Pause recorder to prevent potential recursive calls by inspect()
  pauseRecorder();
  const result = inspect(value, { depth: 1 });
  resumeRecorder();
  return result;
}

export function optParameter(value: unknown): AppMap.Parameter | undefined {
  if (value === undefined) return undefined;
  return parameter(value);
}

export function getClass(value: unknown): string {
  if (typeof value === "undefined") return "undefined";
  if (value === null || Object.getPrototypeOf(value) === null) return "object";
  return value.constructor.name;
}

function parameterSchema(value: unknown): AppMap.ParameterSchema {
  const result: AppMap.ParameterSchema = { class: getClass(value) };
  if (value instanceof Array) result.items = itemsSchema(value);
  else if (isSimpleObject(value)) result.properties = propertiesSchema(value);
  return result;
}

function isSimpleObject(value: unknown): value is Record<string, unknown> {
  if (!(value && typeof value === "object")) return false;
  return Object.getPrototypeOf(value) === null || value.constructor === Object;
}

function itemsSchema([head, ...tail]: unknown[]): AppMap.ParameterSchema | undefined {
  if (!head) return;

  const schema = parameterSchema(head);
  for (const item of tail) if (!isDeepStrictEqual(schema, parameterSchema(item))) return;

  return schema;
}

function propertiesSchema(
  value: Record<string, unknown>,
): ({ name: string } & AppMap.ParameterSchema)[] {
  return Object.entries(value).map(([name, v]) => ({ name, ...parameterSchema(v) }));
}

let nextId = 1;
let objectIds = new WeakMap<object, number>();

export function objectId(object: object | null): number {
  if (object === null) return 0;
  const id = objectIds.get(object) ?? nextId++;
  if (!objectIds.has(object)) objectIds.set(object, id);
  return id;
}

// for testing purposes
export function resetObjectIds() {
  nextId = 1;
  objectIds = new WeakMap();
}
