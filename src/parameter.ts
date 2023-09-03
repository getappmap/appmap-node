import { inspect } from "util";

export interface Parameter {
  name?: string;
  object_id?: number | string;
  class: string;
  value: string;
}

export function parameter(value: unknown): Parameter {
  return {
    class: getClass(value),
    value: inspect(value),
  };
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
