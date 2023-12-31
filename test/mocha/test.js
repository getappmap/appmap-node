const { multiply, power } = require("./calc");
var assert = require("assert");

describe(multiply.name, function () {
  it("multiplies numbers correctly", function () {
    assert.equal(multiply(2, 5), 10);
  });
});

describe(multiply.name, function () {
  it("calculates power correctly", function () {
    assert.equal(power(3, 2), 9);
  });
});

class TestError extends Error {}

function errorOut() {
  throw new TestError("test error");
}

describe("exception handling", () => {
  it("intentionally throws", () => errorOut());
});
