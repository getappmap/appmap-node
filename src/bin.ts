import { spawn } from "node:child_process";
import { accessSync } from "node:fs";
import { resolve } from "node:path";

import { info } from "./message";
import { version } from "./version";

const registerPath = resolve(__dirname, "../dist/register.js");

export function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd) return usage();

  info("Running with appmap-node version %s", version);
  addNodeOptions("--require", registerPath);

  if (isScript(cmd)) {
    process.argv.splice(1, 1); // remove ourselves from argv
    runScript(cmd);
  } else {
    // it's a command, spawn it
    spawn(cmd, args, { stdio: "inherit" });
  }
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