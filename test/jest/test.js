const { sum, sub } = require("./calc");

describe(sum, () => {
  it("sums numbers correctly", () => {
    expect(sum(1, 2)).toBe(3);
  });
});

describe(sub, () => {
  it("subtracts numbers correctly", () => {
    expect(sum(1, 2)).toBe(-1);
  });
});
