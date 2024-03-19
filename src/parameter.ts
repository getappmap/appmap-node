import { ClientRequest, IncomingMessage, ServerResponse } from "node:http";
import { format, inspect, isDeepStrictEqual } from "node:util";

import type * as AppMap from "./AppMap";
import { pauseRecorder, resumeRecorder } from "./recorderControl";
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

const kCustomInspect = Symbol("AppMap.customInspect");

export function setCustomInspect<T>(value: T, customInspect: (v: T) => string): T {
  if (value !== null && typeof value === "object" && !(kCustomInspect in value))
    Object.defineProperty(value, kCustomInspect, {
      value: customInspect,
      enumerable: false,
      writable: true,
    });
  return value;
}

function doInspect(value: unknown): string {
  if (typeof value === "object" && value && kCustomInspect in value)
    return (value as { [kCustomInspect]: (v: typeof value) => string })[kCustomInspect](value);
  return inspect(value, { depth: 1, customInspect: false });
}

export function stringify(value: unknown): string {
  if (value instanceof IncomingMessage)
    return format("[IncomingMessage: %s %s]", value.method, value.url);
  if (value instanceof ClientRequest) return formatClientRequest(value);
  if (value instanceof ServerResponse)
    return format(
      "[ServerResponse: %s]",
      [value.statusCode, value.statusMessage].filter(Boolean).join(" "),
    );
  // Pause recorder to prevent potential recursive calls by inspect()
  pauseRecorder();
  const result = doInspect(value);
  resumeRecorder();
  return result;
}

function formatClientRequest(value: ClientRequest): string {
  const result = ["[ClientRequest: "];
  if (value.method) result.push(value.method, " ");
  if (value.protocol) result.push(value.protocol, "//");
  if (value.host) result.push(value.host);
  if (value.path) result.push(value.path);
  result.push("]");
  return result.join("");
}

export function optParameter(value: unknown): AppMap.Parameter | undefined {
  if (value === undefined) return undefined;
  return parameter(value);
}

export function getClass(value: unknown): string {
  if (typeof value === "undefined") return "undefined";
  if (value === null || Object.getPrototypeOf(value) === null) return "object";

  // tRPC proxies the object and throws an error when its constructor is accessed.
  // "Error: Tried to access "$types.constructor" which is not available at runtime"
  // https://github.com/trpc/trpc/blob/774b75c7a9bdbde1a85741a8baa24be06ad3e207/packages/server/src/core/initTRPC.ts#L131
  try {
    return value.constructor.name;
  } catch {
    return "unknown";
  }
}

function parameterSchema(value: unknown, objectsSeen?: Set<object>): AppMap.ParameterSchema {
  const result: AppMap.ParameterSchema = { class: getClass(value) };

  // Handle circular references to prevent stack overflow
  if (objectsSeen == null) objectsSeen = new Set();
  if (value && typeof value === "object") {
    if (objectsSeen.has(value)) return result;
    objectsSeen.add(value);
  }

  if (value instanceof Array) result.items = itemsSchema(value, objectsSeen);
  else if (isSimpleObject(value)) result.properties = propertiesSchema(value, objectsSeen);
  return result;
}

function isSimpleObject(value: unknown): value is Record<string, unknown> {
  if (!(value && typeof value === "object")) return false;
  return Object.getPrototypeOf(value) === null || value.constructor === Object;
}

function itemsSchema(
  [head, ...tail]: unknown[],
  objectsSeen?: Set<object>,
): AppMap.ParameterSchema | undefined {
  if (!head) return;

  const schema = parameterSchema(head, objectsSeen);
  for (const item of tail)
    if (!isDeepStrictEqual(schema, parameterSchema(item, objectsSeen))) return;

  return schema;
}

function propertiesSchema(
  value: Record<string, unknown>,
  objectsSeen?: Set<object>,
): ({ name: string } & AppMap.ParameterSchema)[] {
  return Object.entries(value).map(([name, v]) => ({ name, ...parameterSchema(v, objectsSeen) }));
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
