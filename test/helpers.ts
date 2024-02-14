import assert from "node:assert";
import { ChildProcessWithoutNullStreams, spawn, spawnSync } from "node:child_process";
import { accessSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";

import caller from "caller";
import { globSync } from "fast-glob";

import type AppMap from "../src/AppMap";
import fwdSlashPath from "../src/util/fwdSlashPath";

const binPath = resolve(__dirname, "../bin/appmap-node.js");

export function runAppmapNode(...args: string[]) {
  console.debug("Running %s %s", binPath, args.join(" "));
  const result = spawnSync(process.argv[0], [binPath, ...args], { cwd: target });
  let message = "";
  if (result.stdout.length > 0) message += "stdout:\n" + result.stdout.toString();
  if (result.stderr.length > 0) message += "stderr:\n" + result.stderr.toString();
  if (message.length > 0) console.debug(message);
  return result;
}

export function spawnAppmapNode(...args: string[]): ChildProcessWithoutNullStreams {
  console.debug("Running %s %s", binPath, args.join(" "));
  const result = spawn(process.argv[0], [binPath, ...args], { cwd: target });
  result.stdout.on("data", (chunk: Buffer) => console.debug("stdout: %s", chunk));
  result.stderr.on("data", (chunk: Buffer) => console.debug("stderr: %s", chunk));
  return result;
}

let target = fwdSlashPath(cwd());

export function testDir(path: string) {
  target = fwdSlashPath(resolve(path));
}

beforeEach(() => rmSync(resolveTarget("tmp"), { recursive: true, force: true, maxRetries: 3 }));

export function resolveTarget(...path: string[]): string {
  return resolve(target, ...path);
}

export function integrationTest(name: string, fn?: jest.ProvidesCallback, timeout?: number): void {
  testDir(caller().replace(/\.test\.[tj]s$/, "/"));
  test(name, fn, timeout);
}

integrationTest.only = function (name: string, fn?: jest.ProvidesCallback, timeout?: number): void {
  testDir(caller().replace(/\.test\.[tj]s$/, "/"));
  test.only(name, fn, timeout);
};

integrationTest.if = (condition: boolean) => (condition ? integrationTest : test.skip);

type AppMap = object & Record<"events", unknown>;

export function readAppmap(path?: string): AppMap.AppMap {
  if (!path) {
    const files = globSync(fwdSlashPath(resolve(target, "tmp/**/*.appmap.json")));
    expect(files.length).toBe(1);
    [path] = files;
  }

  const result = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return fixAppmap(result);
}

export function fixAppmap(map: unknown): AppMap.AppMap {
  assert(typeof map === "object" && map && "events" in map);
  assert(map.events instanceof Array);
  map.events.forEach(fixEvent);
  assert("classMap" in map && map.classMap instanceof Array);
  assert("version" in map && typeof map.version === "string");
  fixClassMap(map.classMap);
  if ("metadata" in map && typeof map.metadata === "object" && map.metadata)
    fixMetadata(map.metadata as AppMap.Metadata);
  if ("eventUpdates" in map && typeof map.eventUpdates === "object" && map.eventUpdates)
    Object.values(map.eventUpdates).forEach(fixEvent);

  return map as AppMap.AppMap;
}

export function readAppmaps(): Record<string, AppMap.AppMap> {
  const files = globSync(fwdSlashPath(resolve(target, "tmp/**/*.appmap.json")));
  const maps = files.map<[string, AppMap.AppMap]>((path) => [fixPath(path), readAppmap(path)]);
  return Object.fromEntries(maps);
}

function fixEvent(event: unknown) {
  if (!(event && typeof event === "object")) return;
  if ("path" in event) {
    const { path } = event;
    if (typeof path !== "string") return;
    event.path = fixPath(path);
  }

  for (const http of [
    "http_server_request",
    "http_server_response",
    "http_client_request",
    "http_client_response",
  ])
    if (http in event) fixHttp((event as Record<string, unknown>)[http]);

  if ("elapsed" in event && typeof event.elapsed === "number") event.elapsed = 31.337;
  if ("parameters" in event && event.parameters instanceof Array)
    event.parameters.forEach(fixValue);
  if ("return_value" in event) fixValue(event.return_value);
}

function fixHttp(http: unknown) {
  if (!(http && typeof http === "object" && "headers" in http)) return;
  const { headers } = http;
  if (headers && typeof headers === "object") {
    for (const header of ["Date", "Connection", "Keep-Alive", "Etag"])
      if (header in headers) delete (headers as Record<string, unknown>)[header];
  }
}

function fixValue(value: unknown): void {
  if (value && typeof value === "object" && "value" in value && typeof value.value === "string") {
    const v = value.value;
    if (v.startsWith("Next")) value.value = v.split(" ")[0];
    else if (v.includes("ObjectId"))
      value.value = v.replaceAll(/ObjectId\('.*'\)/g, "ObjectId('test')");
    else value.value = v.replaceAll(/\s+\[Symbol.*/g, "");
  }
}

const timestamps: Record<string, string> = {};
let timestampId = 0;
beforeEach(() => (timestampId = 0));

function fixTimeStamps(str: string): string {
  return str.replaceAll(
    /\d{4}-\d{2}-\d{2}T\d{2}[:-]\d{2}[:-]\d{2}\.\d{3}Z/g,
    (ts) => (timestamps[ts.replaceAll(":", "-")] ||= `<timestamp ${timestampId++}>`),
  );
}

function fixPath(path: string): string {
  return fixTimeStamps(fwdSlashPath(path).replace(target, "."));
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
  if (metadata.client.version) metadata.client.version = "test node-appmap version";
  if (metadata.name) metadata.name = fixTimeStamps(metadata.name);
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
