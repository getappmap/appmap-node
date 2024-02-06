import assert from "node:assert";
import { spawnSync } from "node:child_process";

import { integrationTest, readAppmap, resolveTarget, runAppmapNode } from "./helpers";

integrationTest("esm-loader is loaded when required", () => {
  expect(runAppmapNode("node", "--loader", "ts-node/esm", "src/index.ts").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("appmap-node uses external source maps", () => {
  expect(
    spawnSync("yarn", ["tsc"], { cwd: resolveTarget(), shell: true, stdio: "inherit" }).status,
  ).toBe(0);
  expect(runAppmapNode("dist/index.js").status).toBe(0);
  const appMap = readAppmap();
  const fun = appMap.classMap.at(0)?.children?.at(0)?.children?.at(0);
  assert(fun?.type === "function");
  expect(fun.location).toMatch(/^src\/index.ts:/);
});
