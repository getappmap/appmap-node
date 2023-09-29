import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { accessSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";

import caller from "caller";
import { globSync } from "fast-glob";

import type AppMap from "../src/AppMap";

const binPath = resolve(__dirname, "../bin/appmap-node.js");

export function runAppmapNode(...args: string[]) {
  return runCommand(process.argv[0], binPath, ...args);
}

export function runCommand(command: string, ...args: string[]) {
  const result = spawnSync(command, args, { cwd: target });
  assert(result.status === 0 && result.error === undefined);
  return result;
}

let target = cwd();

export function testDir(path: string) {
  target = resolve(path);
  beforeEach(() => rmSync(resolve(target, "tmp"), { recursive: true, force: true }));
}

export function integrationTest(name: string, fn?: jest.ProvidesCallback, timeout?: number): void {
  testDir(caller().replace(/\.test\.[tj]s$/, "/"));
  test(name, fn, timeout);
}

type AppMap = object & Record<"events", unknown>;

export function readAppmap(path?: string): AppMap {
  if (!path) {
    const files = globSync(resolve(target, "tmp/**/*.appmap.json"));
    expect(files.length).toBe(1);
    [path] = files;
  }

  const result = JSON.parse(readFileSync(path, "utf8")) as unknown;
  assert(typeof result === "object" && result && "events" in result);
  assert(result.events instanceof Array);
  result.events.forEach(fixEvent);
  if ("classMap" in result && result.classMap instanceof Array) fixClassMap(result.classMap);
  if ("metadata" in result && typeof result.metadata === "object" && result.metadata)
    fixMetadata(result.metadata as AppMap.Metadata);

  return result;
}

export function readAppmaps(): Record<string, AppMap> {
  const files = globSync(resolve(target, "tmp/**/*.appmap.json"));
  const maps = files.map<[string, AppMap]>((path) => [fixPath(path), readAppmap(path)]);
  return Object.fromEntries(maps);
}

function fixEvent(event: unknown) {
  if (!(event && typeof event === "object" && "path" in event)) return;
  const { path } = event;
  if (typeof path !== "string") return;
  event.path = fixPath(path);
}

function fixPath(path: string): string {
  if (path.startsWith(target)) return path.replace(target, ".");
  else return path;
}

function fixClassMap(classMap: unknown[]) {
  for (const entry of classMap) {
    if (!(entry && typeof entry === "object")) continue;
    if ("location" in entry && typeof entry.location === "string")
      entry.location = fixPath(entry.location);
    if ("children" in entry && entry.children instanceof Array) fixClassMap(entry.children);
  }
}

function fixMetadata(metadata: AppMap.Metadata) {
  if (metadata.recorder.type === "process") metadata.name = "test process recording";
  if (metadata.language) metadata.language.version = "test node version";
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
