import AppMap from "../AppMap";
import { optParameter, parameter } from "../parameter";

class Klass {
  constructor(public value: unknown) {}
}

const examples: [unknown, string, string, Partial<AppMap.Parameter>][] = [
  [42, "Number", "42", {}],
  [null, "object", "null", {}],
  ["bacon", "String", "'bacon'", {}],
  [{ foo: 42 }, "Object", "{ foo: 42 }", { properties: [{ name: "foo", class: "Number" }] }],
  [new Klass(42), "Klass", "Klass { value: 42 }", {}],
  [[], "Array", "[]", { size: 0 }],
  [[42, 43], "Array", "[ 42, 43 ]", { size: 2, items: { class: "Number" } }],
  [[42, "foo"], "Array", "[ 42, 'foo' ]", { size: 2 }],
];

describe(parameter, () => {
  it.each([...examples, [undefined, "undefined", "undefined", {}]])(
    "tranforms %s into an AppMap parameter",
    (original, klass, value, schema) =>
      expect(parameter(original)).toStrictEqual({ class: klass, value, ...schema }),
  );
});

describe(optParameter, () => {
  it.each([...examples, [undefined, undefined, undefined, {}]])(
    "tranforms %s into an optional AppMap parameter",
    (original, klass, value, schema) =>
      expect(optParameter(original)).toStrictEqual(
        klass ? { class: klass, value, ...schema } : undefined,
      ),
  );
});
