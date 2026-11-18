import { spawnSync } from "node:child_process";
import { copyFileSync, rmSync } from "node:fs";

import { integrationTest, readAppmap, resolveTarget, runAppmapNodeWithOptions } from "./helpers";

// Prisma 7 requires Node.js ^20.19 || ^22.12 || >=24
const nodeSupported = (() => {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return major >= 24 || (major == 22 && minor >= 12) || (major == 20 && minor >= 19);
})();

function testWithAdapter(adapter: string) {
  return () => {
    const testDir = resolveTarget();
    copyFileSync(`${testDir}/../prisma/original.db`, `${testDir}/test.db`);
    spawnSync("yarn", ["prisma", "generate"], { cwd: testDir, shell: true });
    const env = { ...process.env, ADAPTER: adapter };
    expect(runAppmapNodeWithOptions({ env }, "node", "script.js").status).toBe(0);
    expect(readAppmap()).toMatchSnapshot();
    rmSync(`${testDir}/test.db`);
  };
}

// We don't hook libsql, so the queries are recorded from Prisma's query events.
integrationTest.if(nodeSupported)(
  "mapping Prisma 7 with a libsql adapter",
  testWithAdapter("libsql"),
);

// We hook better-sqlite3, so the queries are recorded by its hook, and only once.
integrationTest.if(nodeSupported)(
  "mapping Prisma 7 with a better-sqlite3 adapter",
  testWithAdapter("better-sqlite3"),
);
