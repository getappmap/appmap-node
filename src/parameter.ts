import { IncomingMessage, ServerResponse } from "node:http";
import { format, inspect, isDeepStrictEqual } from "node:util";

import type AppMap from "./AppMap";
import compactObject from "./util/compactObject";

export function parameter(value: unknown): AppMap.Parameter {
  const schema: AppMap.ParameterSchema = parameterSchema(value);

  return compactObject({
    ...schema,
    value: stringify(value),
    size: value instanceof Array ? value.length : undefined,
  });
}

function stringify(value: unknown): string {
  if (value instanceof IncomingMessage)
    return format("[IncomingMessage: %s %s]", value.method, value.url);
  if (value instanceof ServerResponse)
    return format(
      "[ServerResponse: %s]",
      [value.statusCode, value.statusMessage].filter(Boolean).join(" "),
    );

  return inspect(value, { depth: 1 });
}

export function optParameter(value: unknown): AppMap.Parameter | undefined {
  if (value === undefined) return undefined;
  return parameter(value);
}

function getClass(value: unknown): string {
  if (value === null) return "object";
  if (typeof value === "undefined") return "undefined";
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
