import { spawn } from "node:child_process";
import { accessSync } from "node:fs";
import { resolve } from "node:path";

const registerPath = resolve(__dirname, "../dist/register.js");

export function main() {
  addNodeOptions("--require", registerPath);
  const [cmd, ...args] = process.argv.slice(2);

  if (isScript(cmd)) {
    process.argv.splice(1, 1); // remove outselves from argv
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

if (require.main === module) main();