import { IncomingMessage, ServerResponse } from "http";
import { format, inspect } from "util";

export interface Parameter {
  name?: string;
  object_id?: number | string;
  class: string;
  value: string;
}

export function parameter(value: unknown): Parameter {
  return {
    class: getClass(value),
    value: stringify(value),
  };
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

export function optParameter(value: unknown): Parameter | undefined {
  if (value === undefined) return undefined;
  return parameter(value);
}

function getClass(value: unknown): string {
  if (value === null) return "object";
  if (typeof value === "undefined") return "undefined";
  return value.constructor.name;
}
