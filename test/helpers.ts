import { spawnSync } from "node:child_process";
import { accessSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { chdir, cwd } from "node:process";

import { globSync } from "fast-glob";
import assert from "node:assert";

const binPath = resolve(__dirname, "../bin/appmap-node.js");

export function runAppmapNode(...args: string[]) {
  return spawnSync(process.argv[0], [binPath, ...args]);
}

const origCwd = cwd();
let target = origCwd;

export function testDir(path: string) {
  target = resolve(path);
  beforeEach(() => {
    rmSync(resolve(target, "tmp"), { recursive: true, force: true });
    chdir(target);
  });
  afterEach(() => chdir(origCwd));
}

export function readAppmap(path?: string): object & Record<"events", unknown> {
  if (!path) {
    const files = globSync("tmp/**/*.appmap.json");
    expect(files.length).toBe(1);
    [path] = files;
  }

  const result = JSON.parse(readFileSync(path, "utf8")) as unknown;
  assert(typeof result === "object" && result && "events" in result);
  assert(result.events instanceof Array);
  for (const event of result.events) fixPath(event);

  return result;
}

function fixPath(event: unknown) {
  if (!(event && typeof event === "object" && "path" in event)) return;
  const { path } = event;
  if (typeof path !== "string") return;
  if (path.startsWith(target)) event.path = path.replace(target, ".");
}

function ensureBuilt() {
  const probePath = resolve(__dirname, "../dist/register.js");
  try {
    accessSync(probePath);
  } catch {
    spawnSync("yarn", ["prepack"], { cwd: resolve(__dirname, ".."), stdio: "inherit" });
  }
}

ensureBuilt();