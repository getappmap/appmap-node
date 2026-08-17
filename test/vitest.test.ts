import path from "node:path";
import util from "node:util";
import { readAppmaps, runAppmapNode, testDir } from "./helpers";

// v0 keeps the original flag set
describe("vitest v0", () => {
  beforeAll(() => testDir(path.join(__dirname, "vitest")));

  test.each(["", "--single-thread", "--no-threads"])("mapping vitest run %s", (arg) => {
    expect(runAppmapNode("yarn", "vitest", "run", arg).status).toBe(1);
    expect(readAppmaps()).toMatchSnapshot();
  });
});

// vitest 4 declares engines.node ^20.0.0 || ^22.0.0 || >=24.0.0, but the real
// floor is tighter: it pulls vite 8, whose rolldown imports `styleText` from
// node:util. That landed in Node 20.12 and 21.7, so on Node 18, 20.0-20.11 and
// 21.0-21.6 the import is a SyntaxError at module load and `vitest run` dies
// before producing any AppMaps at all, rather than failing a test.
//
// Feature-detect instead of encoding that version table -- the child process
// spawned by runAppmapNode uses this same binary (process.argv[0]), so probing
// node:util here answers the question for the run that actually matters.
const nodeSupportsVitest4 = "styleText" in util;

// v1+ uses pool-based flags
describe.each([
  ["1", path.join(__dirname, "vitest1")],
  ["2", path.join(__dirname, "vitest2")],
  ["3", path.join(__dirname, "vitest3")],
  ["4", path.join(__dirname, "vitest4")],
])("vitest v%s", (version, dir) => {
  beforeAll(() => testDir(dir));

  const maybeTest = version === "4" && !nodeSupportsVitest4 ? test.skip : test;
  maybeTest.each(["", "--pool=forks"])("mapping vitest run %s", (arg) => {
    const args = arg ? ["yarn", "vitest", "run", arg] : ["yarn", "vitest", "run"];
    expect(runAppmapNode(...args).status).toBe(1);
    expect(readAppmaps()).toMatchSnapshot();
  });
});
