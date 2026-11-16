import { type IncomingMessage, request, OutgoingMessage } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";

import {
  SpawnAppmapNodeOptions,
  detachOutput,
  fixAppmap,
  integrationTest,
  readAppmaps,
  runAppmapNodeWithOptions,
  spawnAppmapNodeWithOptions,
} from "./helpers";
import type * as AppMap from "../src/AppMap";
import { ChildProcessWithoutNullStreams } from "child_process";

integrationTest("mapping Express.js requests", async () => {
  expect.assertions(1);
  const { server, port } = await spawnServer("express.js");
  await makeRequests(port);
  // Wait for the last request to finish
  await waitForLine(server, "api-bar.appmap.json");
  await killServer(server);
  expect(readAppmaps()).toMatchSnapshot();
});

integrationTest("mapping node:http requests", async () => {
  expect.assertions(1);
  const { server, port } = await spawnServer("vanilla.js");
  await makeRequests(port);
  // Wait for the last request to finish
  await waitForLine(server, "api-bar.appmap.json");
  await killServer(server);
  expect(readAppmaps()).toMatchSnapshot();
});

const integrationTestSkipOnWindows = process.platform == "win32" ? test.skip : integrationTest;
// Ensuring recorder.ts:finishRecordings() to be called requires special handling in
// this integration test for Windows as we do it in next.test.ts.
// We skip it here to not complicate the testing code, since we are already testing
// process recording always active mode in jest and mocha tests in Windows.
integrationTestSkipOnWindows(
  "mapping node:http requests with process recording active",
  async () => {
    expect.assertions(3);
    const { server, port } = await spawnServer("vanilla.js", {
      env: { ...process.env, APPMAP_RECORDER_PROCESS_ALWAYS: "true" },
    });
    await makeRequests(port);
    // Wait for the last request to finish
    await waitForLine(server, "api-bar.appmap.json");
    await killServer(server);

    const appmaps = readAppmaps();
    const appmapsArray = Object.values(appmaps);
    expect(appmapsArray.filter((a) => a.metadata?.recorder.type == "process").length).toEqual(1);
    expect(appmapsArray.filter((a) => a.metadata?.recorder.type == "requests").length).toEqual(4);
    expect(appmaps).toMatchSnapshot();
  },
);

integrationTest("mapping Express.js requests with remote recording", async () => {
  expect.assertions(1);
  const { server, port } = await spawnServer("express.js");
  await makeRequest(port, "/_appmap/record", "POST");
  await makeRequests(port);
  const appmap = JSON.parse(await makeRequest(port, "/_appmap/record", "DELETE")) as unknown;
  expect(fixAppmap(appmap)).toMatchSnapshot();
  await killServer(server);
});

integrationTest("mapping node:http requests with remote recording", async () => {
  expect.assertions(1);
  const { server, port } = await spawnServer("vanilla.js");
  await makeRequest(port, "/_appmap/record", "POST");
  await makeRequests(port);
  const appmap = JSON.parse(await makeRequest(port, "/_appmap/record", "DELETE")) as unknown;
  expect(fixAppmap(appmap)).toMatchSnapshot();
  await killServer(server);
});

describe.each([
  ["", {}],
  // the server's async context gets flushed before the requests arrive
  ["after async tracking timeout", { DELAY: "300", APPMAP_ASYNC_TRACKING_TIMEOUT: "200" }],
])("mapping async request handlers %s", (_, env) => {
  integrationTest("keeps each request a well-nested subtree", () => {
    const result = runAppmapNodeWithOptions(
      { env: { ...process.env, APPMAP_RECORDER_PROCESS_ALWAYS: "true", ...env } },
      "async.js",
    );
    expect(result.status).toBe(0);

    const appmaps = Object.values(readAppmaps());
    const processAppmap = appmaps.find((a) => a.metadata?.recorder.type == "process")!;
    const requestAppmaps = appmaps.filter((a) => a.metadata?.recorder.type == "requests");
    // There's only one request recording at a time, so /slow's gets abandoned
    // when the overlapping /fast request comes in.
    expect(requestAppmaps.map((a) => a.metadata?.name?.replace(/ — .*/, "")).sort()).toEqual([
      "GET /fast (200)",
      "GET /stream (aborted)",
      "POST /body (200)",
    ]);

    const processRequests = checkRequests(processAppmap);
    expect(processRequests.sort()).toEqual(["/body", "/fast", "/slow", "/stream"]);
    for (const appmap of requestAppmaps) {
      const path = appmap.metadata?.name?.split(" ")[1];
      expect(checkRequests(appmap)).toEqual([path]);
    }
  });
});

describe.each([
  ["started from a running function", { LAYOUT: "main" }],
  // the requests are written out at the root level, so they wait for main()
  // to be given up on
  ["started from a returned function", { LAYOUT: "helper", APPMAP_ASYNC_TRACKING_TIMEOUT: "100" }],
])("mapping a long-running server %s", (_, env) => {
  integrationTest("writes requests out as they are done", () => {
    const result = runAppmapNodeWithOptions(
      { env: { ...process.env, APPMAP_RECORDER_PROCESS_ALWAYS: "true", ...env } },
      "streaming.js",
    );
    expect(result.status).toBe(0);
    expect(result.stdout.toString()).toContain("written requests: 10");

    const appmap = Object.values(readAppmaps()).find((a) => a.metadata?.recorder.type == "process");
    expect(subtrees(appmap?.events ?? [], (e) => "http_server_request" in e)).toHaveLength(10);
  });
});

// Checks each recorded request is a well-nested subtree containing its handler
// in full, and returns the request paths.
function checkRequests(appmap: AppMap.AppMap): string[] {
  const requests = subtrees(appmap.events ?? [], (e) => "http_server_request" in e);
  const handlerCalls: Record<string, string[]> = {
    "/body": ["handle", "handleBody"],
    "/stream": ["handle"],
    "/slow": ["handle", "sleep", "sleep"],
    "/fast": ["handle", "sleep", "sleep"],
  };
  for (const [call, ...rest] of requests) {
    const path = requestPath(call);
    expect(
      rest.flatMap((e) => (e.event == "call" && "method_id" in e ? [e.method_id] : [])),
    ).toEqual(handlerCalls[path]);
    const response = rest.at(-1) as AppMap.HttpServerResponseEvent;
    if (path == "/stream") expect(response.http_server_response).toBeUndefined();
    else expect(response.http_server_response).toMatchObject({ status_code: 200 });
  }
  return requests.map(([call]) => requestPath(call));
}

// Checks the events form a well-nested tree and returns the subtrees rooted
// at calls matching the predicate, each with its call and return event.
function subtrees(
  events: AppMap.Event[],
  predicate: (call: AppMap.CallEvent) => boolean,
): AppMap.Event[][] {
  const result: AppMap.Event[][] = [];
  const stack: { call: AppMap.CallEvent; start: number }[] = [];
  events.forEach((event, idx) => {
    if (event.event == "call") stack.push({ call: event, start: idx });
    else {
      const top = stack.pop();
      expect(event.parent_id).toBe(top?.call.id);
      if (top && predicate(top.call)) result.push(events.slice(top.start, idx + 1));
    }
  });
  expect(stack).toEqual([]);
  return result;
}

function requestPath(call: AppMap.Event) {
  return (call as AppMap.HttpServerRequestEvent).http_server_request.path_info;
}

async function waitForLine(
  server: ChildProcessWithoutNullStreams,
  search: string | RegExp,
): Promise<string> {
  return new Promise<string>((resolve) => {
    const onData = (chunk: Buffer) => {
      for (const line of chunk.toString().split("\n")) {
        if (typeof search === "string" ? line.includes(search) : search.test(line)) {
          server.stdout.removeListener("data", onData);
          resolve(line);
          return;
        }
      }
    };
    server.stdout.on("data", onData);
  });
}

async function makeRequests(port: number) {
  // Small delays ensure each request gets a distinct millisecond timestamp in its
  // AppMap filename. Without them, consecutive requests can complete within the same
  // millisecond (especially on Node 24), producing identical filename prefixes whose
  // glob ordering is non-deterministic.
  await makeRequest(port, "");
  await sleep(10);
  await makeRequest(port, "/nonexistent");
  await sleep(10);
  await makeRequest(port, "/api/foo?param1=3&param2=4");
  await sleep(10);
  await makeRequest(port, "/api/bar", "POST", (req) => {
    req.appendHeader("Content-Type", "application/json");
    req.write(
      JSON.stringify({
        key: "value",
        obj: { foo: 42, arr: [44] },
        arr: [{ foo: 43 }, { foo: 44 }],
        heterogenous: [42, "str"],
      }),
    );
  });
}

async function spawnServer(script: string, options: SpawnAppmapNodeOptions = {}) {
  const server = spawnAppmapNodeWithOptions(options, script);
  const line = await waitForLine(server, /listening/i);
  const port = parseInt(/(\d+)\s*$/.exec(line)![1], 10);
  return { server, port };
}

async function makeRequest(
  port: number,
  path: string,
  method = "GET",
  prepare?: (req: OutgoingMessage) => void,
): Promise<string> {
  const url = new URL(path, `http://127.0.0.1:${port}`);
  const response = new Promise<IncomingMessage>((resolve, reject) => {
    const req = request(url, { method }, resolve).once("error", reject);
    if (prepare) prepare(req);
    req.end();
  });
  const chunks = [];
  for await (const chunk of await response) chunks.push(chunk as Uint8Array);
  return Buffer.concat(chunks).toString();
}

async function killServer(server: ChildProcessWithoutNullStreams) {
  server.kill("SIGINT");
  await new Promise<void>((r) => server.on("close", () => r()));
  detachOutput(server);
}
