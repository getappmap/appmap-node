import { expect, test } from "vitest";
import { sum, sub } from "./calc";

test("adds 1 + 2 to equal 3", () => {
  expect(sum(1, 2)).toBe(3);
});

test("subtracts 9 - 2 to equal 7", () => {
  expect(sub(9, 2)).toBe(7);
});
