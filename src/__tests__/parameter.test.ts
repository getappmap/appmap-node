import AppMap from "../AppMap";
import { objectId, optParameter, parameter } from "../parameter";

class Klass {
  constructor(public value: unknown) {}
}

const nullobj = Object.create(null) as Record<string, unknown>;
nullobj.foo = "bar";

const examples: [unknown, string, string, Partial<AppMap.Parameter>][] = [
  [42, "Number", "42", {}],
  [null, "object", "null", {}],
  ["bacon", "String", "'bacon'", {}],
  [{ foo: 42 }, "Object", "{ foo: 42 }", { properties: [{ name: "foo", class: "Number" }] }],
  [new Klass(42), "Klass", "Klass { value: 42 }", {}],
  [[], "Array", "[]", { size: 0 }],
  [[42, 43], "Array", "[ 42, 43 ]", { size: 2, items: { class: "Number" } }],
  [[42, "foo"], "Array", "[ 42, 'foo' ]", { size: 2 }],
  [
    nullobj,
    "object",
    "[Object: null prototype] { foo: 'bar' }",
    { properties: [{ name: "foo", class: "String" }] },
  ],
];

describe(parameter, () => {
  it.each([...examples, [undefined, "undefined", "undefined", {}]])(
    "tranforms %s into an AppMap parameter",
    (original, klass, value, schema) =>
      expect(parameter(original)).toMatchObject({ class: klass, value, ...schema }),
  );
});

describe(optParameter, () => {
  it.each([...examples, [undefined, undefined, undefined, {}]])(
    "tranforms %s into an optional AppMap parameter",
    (original, klass, value, schema) => {
      if (klass) expect(optParameter(original)).toMatchObject({ class: klass, value, ...schema });
      else expect(optParameter(original)).toBeUndefined();
    },
  );
});

describe(objectId, () => {
  it("returns different id for different objects", () => {
    expect(objectId([])).not.toBe(objectId([]));
    expect(objectId({})).not.toBe(objectId({}));
  });

  it("returns same id for same objects", () => {
    const arr = [42];
    const obj = {};
    expect(objectId(arr)).toBe(objectId(arr));
    expect(objectId(obj)).toBe(objectId(obj));
    expect(objectId(null)).toBe(objectId(null));
  });

  it("returns the same id even if the object is modified", () => {
    const arr = [42];
    const obj: Record<string, unknown> = {};
    const ids = [objectId(arr), objectId(obj)];

    arr.push(43);
    obj.bar = "baz";

    expect([objectId(arr), objectId(obj)]).toStrictEqual(ids);
  });
});
