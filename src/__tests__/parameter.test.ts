import { optParameter, parameter } from "../parameter";

class Klass {
  constructor(public value: unknown) {}
}

const examples: [unknown, string, string][] = [
  [42, "Number", "42"],
  [null, "object", "null"],
  ["bacon", "String", "'bacon'"],
  [{ foo: 42 }, "Object", "{ foo: 42 }"],
  [new Klass(42), "Klass", "Klass { value: 42 }"],
];

describe(parameter, () => {
  it.each([...examples, [undefined, "undefined", "undefined"]])(
    "tranforms %s into an AppMap parameter",
    (original: unknown, klass: string, value: string) =>
      expect(parameter(original)).toStrictEqual({ class: klass, value }),
  );
});

describe(optParameter, () => {
  it.each([...examples, [undefined, undefined, undefined]])(
    "tranforms %s into an optional AppMap parameter",
    (original: unknown, klass: string | undefined, value?: string) =>
      expect(optParameter(original)).toStrictEqual(klass ? { class: klass, value } : undefined),
  );
});
