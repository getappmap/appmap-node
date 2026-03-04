import path from "node:path";
import { readAppmaps, runAppmapNode, testDir } from "./helpers";

// v0 keeps the original flag set
describe("vitest v0", () => {
  beforeAll(() => testDir(path.join(__dirname, "vitest")));

  test.each(["", "--single-thread", "--no-threads"])("mapping vitest run %s", (arg) => {
    expect(runAppmapNode("yarn", "vitest", "run", arg).status).toBe(1);
    expect(readAppmaps()).toMatchSnapshot();
  });
});

// v1+ uses pool-based flags
describe.each([
  ["1", path.join(__dirname, "vitest1")],
  ["2", path.join(__dirname, "vitest2")],
  ["3", path.join(__dirname, "vitest3")],
  ["4", path.join(__dirname, "vitest4")],
])("vitest v%s", (_version, dir) => {
  beforeAll(() => testDir(dir));

  test.each(["", "--pool=forks"])("mapping vitest run %s", (arg) => {
    const args = arg ? ["yarn", "vitest", "run", arg] : ["yarn", "vitest", "run"];
    expect(runAppmapNode(...args).status).toBe(1);
    expect(readAppmaps()).toMatchSnapshot();
  });
});
