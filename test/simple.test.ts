import { cpSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import tmp from "tmp";

import {
  integrationTest,
  readAppmap,
  readAppmaps,
  resolveTarget,
  runAppmapNode,
  spawnAppmapNode,
  testDir,
} from "./helpers";

const integrationTestSkipOnWindows = process.platform == "win32" ? test.skip : integrationTest;

integrationTest("mapping a simple script", () => {
  expect(runAppmapNode("index.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("mapping a simple script with space in name", () => {
  expect(runAppmapNode("name with space.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("mapping an mjs script", () => {
  expect(runAppmapNode("index.mjs").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("mapping js class methods and constructors containing super keyword", () => {
  expect(runAppmapNode("class.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTestSkipOnWindows("forwarding signals to the child", async () => {
  const daemon = spawnAppmapNode("daemon.mjs");
  await new Promise<void>((r) =>
    daemon.stdout.on("data", (chunk: Buffer) => chunk.toString().includes("starting") && r()),
  );

  daemon.kill("SIGINT");
  await new Promise((r) => daemon.once("exit", r));

  expect(daemon.exitCode).toBe(42);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("mapping generator functions", () => {
  expect(runAppmapNode("generator.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("mapping a custom Error class with a message property", () => {
  expect(runAppmapNode("inspect.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTestSkipOnWindows("finish signal is handled", async () => {
  const server = spawnAppmapNode("server.mjs");
  await new Promise<void>((r) =>
    server.stdout.on("data", (chunk: Buffer) => chunk.toString().includes("starting") && r()),
  );

  // verify that we don't have any half-written AppMaps
  expect(Object.entries(readAppmaps())).toHaveLength(0);

  server.kill("SIGINT");
  await new Promise((r) => server.once("exit", r));

  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("mapping an extensionless CommonJS file", () => {
  const args = ["./extensionless"];
  if (process.platform == "win32") args.unshift("node");
  expect(runAppmapNode(...args).status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("running a script after changing the current directory", () => {
  // Need to make sure the appmap "root" stays the same after
  // appmap-node is run, even if the current directory changes.
  const args =
    process.platform == "win32"
      ? ["cd subproject & node subproject.js"]
      : ["bash", "-c", "cd subproject; node subproject.js"];

  expect(runAppmapNode(...args).status).toBe(0);
  expect(readAppmap()).toBeDefined();
});

integrationTest("creating a default config file", () => {
  const index = resolveTarget("index.js");
  const target = tmp.dirSync({ unsafeCleanup: true });
  mkdirSync(join(target.name, "test"));
  testDir(join(target.name, "test"));

  cpSync(index, resolveTarget("index.js"));

  const cfgPath = resolveTarget("appmap.yml");
  expect(runAppmapNode("index.js").status).toBe(0);
  expect(readAppmap()).toBeDefined();

  // check that the default config file was written
  expect(readFileSync(cfgPath, "utf8")).toMatchSnapshot();
});
