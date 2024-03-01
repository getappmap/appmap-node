import assert from "node:assert";
import { ChildProcess, spawn } from "node:child_process";
import { accessSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { kill, pid } from "node:process";
import { pathToFileURL } from "node:url";

import json5 from "json5";
import YAML from "yaml";

import config from "./config";
import { info } from "./message";
import { version } from "./metadata";
import forwardSignals from "./util/forwardSignals";
import { readPkgUp } from "./util/readPkgUp";

const registerPath = resolve(__dirname, "../dist/register.js");
// We need to convert c: to file:// in Windows because:
// "Error: Only URLs with a scheme in: file, data, and node are supported by the default ESM loader.
// On Windows, absolute paths must be valid file:// URLs. Received protocol 'c:'"
const loaderPath = pathToFileURL(resolve(__dirname, "../dist/loader.js")).href;

export function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd) return usage();

  info("Running with appmap-node version %s", version);
  addNodeOptions("--require", registerPath);
  if (config.default) {
    info("Writing default config to %s", config.configPath);
    writeFileSync(config.configPath, YAML.stringify(config));
  } else info("Using config file %s", config.configPath);
  config.export();

  // FIXME: Probably there should be a way to remove this altogether
  // by changing our custom loader implementation
  if (isTsEsmLoaderNeeded(cmd, args)) addNodeOptions("--loader", "ts-node/esm");

  addNodeOptions("--loader", loaderPath, "--no-warnings");

  let child: ChildProcess | undefined;
  if (isScript(cmd)) {
    if (isESM(cmd)) {
      // We need to re-spawn to use our custom loader
      child = spawn(process.argv[0], [cmd, ...args], { stdio: "inherit" });
    } else {
      process.argv.splice(1, 1); // remove ourselves from argv
      return runScript(cmd);
    }
  } else {
    // it's a command, spawn it

    // We need to give shell: true in Windows because we get "Error: spawn yarn ENOENT"
    // for example when the cmd is yarn. Looks like it needs the full path of the
    // executable otherwise.
    // Related articles:
    // - https://stackoverflow.com/questions/37459717/error-spawn-enoent-on-windows
    // - https://github.com/nodejs/node/issues/7367#issuecomment-238594729
    child = spawn(cmd, args, { stdio: "inherit", shell: process.platform == "win32" });
  }

  forwardSignals(child);
  child.on("exit", (code, signal) => {
    if (code === null) {
      assert(signal);
      kill(pid, signal);
    } else process.exitCode = code;
  });
}

function readTsConfigUp(dir: string): string | undefined {
  try {
    return readFileSync(join(dir, "tsconfig.json"), "utf-8");
  } catch {
    const parent = dirname(dir);
    if (parent === dir) return;
    else return readTsConfigUp(parent);
  }
}

function isTsEsmLoaderNeeded(cmd: string, args: string[]) {
  // HACK: Ugly way to check
  const tsConfigTsNodeEsmIsTrue = () => {
    const tsConfigSource = readTsConfigUp(config.root);
    if (tsConfigSource == null) return false;

    const tsConfig: unknown = json5.parse(tsConfigSource);
    // Check if ts-node is configured and has esm set to true
    return (
      tsConfig != null &&
      typeof tsConfig == "object" &&
      "ts-node" in tsConfig &&
      tsConfig["ts-node"] != null &&
      typeof tsConfig["ts-node"] == "object" &&
      "esm" in tsConfig["ts-node"] &&
      tsConfig["ts-node"].esm == true
    );
  };
  return [cmd, ...args].includes("ts-node") || tsConfigTsNodeEsmIsTrue();
}

function addNodeOptions(...options: string[]) {
  const envar = (process.env.NODE_OPTIONS ?? "").split(" ");
  envar.push(...options);
  process.env.NODE_OPTIONS = envar.join(" ");
}

/* Heuristic to check if argument is a node script. Currently just checks if it's an existing file
with a known extension; the assumption being if it's not, then it's probably a command. */
function isScript(arg: string) {
  try {
    accessSync(arg);
    return arg.match(/.*\.[mc]?[tj]s/);
  } catch {
    return false;
  }
}

function isESM(path: string) {
  return path.match(/.*\.m[tj]s/) ?? isPackageJsonTypeModule(path);
}

function isPackageJsonTypeModule(path: string) {
  return readPkgUp(dirname(path))?.type === "module";
}

function runScript(path: string) {
  require(registerPath);
  require(resolve(path));
}

function usage() {
  console.log("appmap-node version %s", version);
  console.log("Usage:");
  console.log("  $ appmap-node <script.js> [script args...]");
  console.log("  $ appmap-node <command> [command args...]");
}

if (require.main === module) main();
