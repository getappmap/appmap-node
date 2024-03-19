import { spawnSync } from "node:child_process";

import { integrationTest, readAppmaps, resolveTarget, runAppmapNode } from "./helpers";

integrationTest("mapping code block recording", () => {
  expect(runAppmapNode("index.js").status).toBe(0);
  expect(readAppmaps()).toMatchSnapshot();
});

integrationTest("throws when not run with appmap-node", () => {
  const testDir = resolveTarget();
  const result = spawnSync(process.argv[0], ["index.js"], { cwd: testDir });
  expect(result.stderr?.toString()).toContain(
    "Code is not instrumented. Please run the project with appmap-node.",
  );
});
