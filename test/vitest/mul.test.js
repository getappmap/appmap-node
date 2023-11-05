import { expect, test } from "vitest";
import { mul } from "./calc";

test("multiplies 0 by 3 to equal 0", () => {
  expect(mul(0, 3)).toBe(0);
});

test("multiplies 5 by 4 to equal 20", () => {
  expect(mul(5, 4)).toBe(20);
});
