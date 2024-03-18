#!/usr/bin/env node

import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { chdir } from "node:process";

import glob from "fast-glob";
import tmp from "tmp";

/* Smoke test script, meant to catch problems with package build.
 * Creates a basic barebones javascript package. Then, packages up
 * appmap-node and installs it into the package.
 * Finally, uses appmap-node to run the package and verifies that
 * it doesn't crash and produces an AppMap. */

// Create a temporary directory to work in.
// To test NODE_OPTIONS handling, use a space in the directory name and use mjs.
const tmpDir = tmp.dirSync({ unsafeCleanup: true, template: "appmap node test XXXXXX" }).name;

runCommand("yarn", "pack", "-o", JSON.stringify(join(tmpDir, "appmap-node.tgz")));

chdir(tmpDir);
runCommand("npm", "init", "-y");
runCommand("npm", "install", "appmap-node.tgz");

writeFileSync(
  "index.mjs",
  `
function main() {
  console.log("Hello world!");
}
main();
`,
);

runCommand("npm", "exec", "appmap-node", "index.mjs");

// verify that appmap has been created
const files = glob.globSync("tmp/**/*.appmap.json");
assert(files.length === 1);

function runCommand(command, ...args) {
  const { status } = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
  });
  assert(status === 0);
}
