import { integrationTest, readAppmap, resolveTarget, runAppmapNode } from "./helpers";
import { copyFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import type * as AppMap from "../src/AppMap";

integrationTest("mapping Prisma tests", () => {
  const testDir = resolveTarget();
  copyFileSync(`${testDir}/original.db`, `${testDir}/test.db`);
  spawnSync("yarn", ["prisma", "generate"], { cwd: testDir, shell: true });
  expect(runAppmapNode("yarn", "node", "script.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
  rmSync(`${testDir}/test.db`);
});

// Prisma 5 doesn't tell which call a query belongs to, and its query events can
// even come after the call is done, when another one has started. Where each
// query ends up is a best guess which depends on timing, so this only checks that
// they're all recorded.
integrationTest("mapping concurrent Prisma calls", () => {
  const testDir = resolveTarget();
  copyFileSync(`${testDir}/original.db`, `${testDir}/test.db`);
  spawnSync("yarn", ["prisma", "generate"], { cwd: testDir, shell: true });
  expect(runAppmapNode("yarn", "node", "concurrent.js").status).toBe(0);
  const queries = sqlQueries(readAppmap().events ?? []);
  expect(queries.length).toBe(20);
  expect(queries.filter((sql) => /^(BEGIN|COMMIT)/.test(sql)).sort()).toEqual(["BEGIN", "COMMIT"]);
  rmSync(`${testDir}/test.db`);
});

function sqlQueries(events: AppMap.Event[]): string[] {
  return events.flatMap((event) => ("sql_query" in event ? [event.sql_query.sql] : []));
}
