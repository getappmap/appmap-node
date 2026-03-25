import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { integrationTest, readAppmaps, runAppmapNode } from "./helpers";

// This test runs vitest in a separate project installed with yarn pnpm linker,
// verifying that matchesPackageFile() correctly identifies hook targets in the
// .store/pkg-npm-version-hash/package/ path format used by yarn 4 pnpm linker.

integrationTest("pnpm linker: vitest hooks instrument code in .store paths", () => {
  const dir = resolve(__dirname, "pnpm-compat");
  const install = spawnSync("yarn", ["install", "--immutable"], {
    cwd: dir,
    shell: process.platform === "win32",
  });
  if (install.status !== 0) {
    process.stdout.write(install.stdout);
    process.stderr.write(install.stderr);
    throw new Error(`yarn install failed with status ${install.status}`);
  }

  expect(runAppmapNode("yarn", "vitest", "run").status).toBe(0);
  expect(readAppmaps()).not.toEqual({});
});
