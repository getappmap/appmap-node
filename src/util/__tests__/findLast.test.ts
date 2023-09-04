import findLast from "../findLast";

describe(findLast, () => {
  it("returns last matching index", () =>
    expect(findLast([1, 2, 3], (a) => a > 1)).toBe(3));

  it("returns undefined for an empty array", () =>
    expect(findLast([], (a) => a > 1)).toBeUndefined());

  it("returns undefined if none match", () =>
    expect(findLast([1, 2, 3], (a) => a > 3)).toBeUndefined());
});
