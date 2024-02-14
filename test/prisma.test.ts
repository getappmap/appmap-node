import { integrationTest, readAppmap, resolveTarget, runAppmapNode } from "./helpers";
import { copyFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

integrationTest("mapping Prisma tests", () => {
  const testDir = resolveTarget();
  copyFileSync(`${testDir}/original.db`, `${testDir}/test.db`);
  spawnSync("yarn", ["prisma", "generate"], { cwd: testDir, shell: true });
  expect(runAppmapNode("yarn", "node", "script.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
  rmSync(`${testDir}/test.db`);
});
