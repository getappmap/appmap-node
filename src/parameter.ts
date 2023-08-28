export type Parameter = {
  name?: string;
  object_id?: number | string;
  class: string;
  value: string;
};

export function parameter(value: unknown): Parameter {
  return {
    class: typeof value,
    value: String(value),
  };
}

export function optParameter(value: unknown): Parameter | undefined {
  if (value === undefined) return undefined;
  return parameter(value);
}
