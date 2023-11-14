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

class TestError extends Error {}

function errorOut() {
  throw new TestError("test error");
}

describe("exception handling", () => {
  it("intentionally throws", errorOut);
});
