import assert from "node:assert";
import { ChildProcess, spawn } from "node:child_process";
import { accessSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { kill, pid } from "node:process";

import { info } from "./message";
import { version } from "./metadata";
import { readPkgUp } from "./util/readPkgUp";
import forwardSignals from "./util/forwardSignals";

const registerPath = resolve(__dirname, "../dist/register.js");
const loaderPath = resolve(__dirname, "../dist/loader.js");

export function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd) return usage();

  info("Running with appmap-node version %s", version);
  addNodeOptions("--require", registerPath);

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
    child = spawn(cmd, args, { stdio: "inherit" });
  }

  forwardSignals(child);
  child.on("exit", (code, signal) => {
    if (code === null) {
      assert(signal);
      kill(pid, signal);
    } else process.exitCode = code;
  });
}

function isTsEsmLoaderNeeded(cmd: string, args: string[]) {
  // HACK: Ugly way to check if it's ts-node instead of node
  return [cmd, ...args].includes("ts-node");
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
