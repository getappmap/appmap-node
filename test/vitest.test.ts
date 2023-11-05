import path from "node:path";
import { readAppmaps, runAppmapNode, testDir } from "./helpers";

testDir(path.join(__dirname, "vitest"));

test.each(["", "--single-thread", "--no-threads"])("mapping vitest run %s", (arg) => {
  expect(runAppmapNode("yarn", "vitest", "run", arg).status).toBe(1);
  expect(readAppmaps()).toMatchSnapshot();
});
