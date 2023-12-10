import assert from "node:assert";
import { ChildProcessWithoutNullStreams, spawn, spawnSync } from "node:child_process";
import { accessSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";

import caller from "caller";
import { globSync } from "fast-glob";

import type AppMap from "../src/AppMap";

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

export function readAppmap(path?: string): AppMap.AppMap {
  if (!path) {
    const files = globSync(resolve(target, "tmp/**/*.appmap.json"));
    expect(files.length).toBe(1);
    [path] = files;
  }

  const result = JSON.parse(readFileSync(path, "utf8")) as unknown;
  assert(typeof result === "object" && result && "events" in result);
  assert(result.events instanceof Array);
  result.events.forEach(fixEvent);
  assert("classMap" in result && result.classMap instanceof Array);
  assert("version" in result && typeof result.version === "string");
  fixClassMap(result.classMap);
  if ("metadata" in result && typeof result.metadata === "object" && result.metadata)
    fixMetadata(result.metadata as AppMap.Metadata);
  if ("eventUpdates" in result && typeof result.eventUpdates === "object" && result.eventUpdates)
    Object.values(result.eventUpdates).forEach(fixEvent);

  return result as AppMap.AppMap;
}

export function readAppmaps(): Record<string, AppMap.AppMap> {
  const files = globSync(resolve(target, "tmp/**/*.appmap.json"));
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
  if (
    "http_server_request" in event &&
    typeof event.http_server_request === "object" &&
    event.http_server_request &&
    "headers" in event.http_server_request &&
    typeof event.http_server_request.headers === "object" &&
    event.http_server_request.headers &&
    "Connection" in event.http_server_request.headers
  )
    // the default of this varies between node versions
    delete event.http_server_request.headers.Connection;

  if (
    "http_client_response" in event &&
    typeof event.http_client_response === "object" &&
    event.http_client_response &&
    "headers" in event.http_client_response &&
    typeof event.http_client_response.headers === "object" &&
    event.http_client_response.headers
  ) {
    if ("Date" in event.http_client_response.headers)
      delete event.http_client_response.headers.Date;
    if ("Connection" in event.http_client_response.headers)
      delete event.http_client_response.headers.Connection;
    if ("Keep-Alive" in event.http_client_response.headers)
      delete event.http_client_response.headers["Keep-Alive"];
  }
  if ("elapsed" in event && typeof event.elapsed === "number") event.elapsed = 31.337;
}

const timestamps: Record<string, string> = {};
let timestampId = 0;
beforeEach(() => (timestampId = 0));

function fixTimeStamps(str: string): string {
  return str.replaceAll(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g,
    (ts) => (timestamps[ts] ||= `<timestamp ${timestampId++}>`),
  );
}

function fixPath(path: string): string {
  return fixTimeStamps(path.replace(target, "."));
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
