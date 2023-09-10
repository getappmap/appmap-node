import compactObject from "../compactObject";

describe(compactObject, () => {
  test.each([
    [{ a: 2, b: undefined }, { a: 2 }],
    [{ b: null }, {}],
  ])("%o", (input, expected) =>
    expect(compactObject(input)).toStrictEqual(expected),
  );
});
