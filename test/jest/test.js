const { sum } = require("./calc");

describe(sum, () => {
  it("sums numbers correctly", () => {
    expect(sum(1, 2)).toBe(3);
  });
});
