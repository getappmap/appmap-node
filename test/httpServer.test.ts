import { type IncomingMessage, request, OutgoingMessage } from "node:http";

import {
  SpawnAppmapNodeOptions,
  fixAppmap,
  integrationTest,
  readAppmaps,
  spawnAppmapNodeWithOptions,
} from "./helpers";
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
  await makeRequest(port, "");
  await makeRequest(port, "/nonexistent");
  await makeRequest(port, "/api/foo?param1=3&param2=4");
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

function killServer(server: ChildProcessWithoutNullStreams) {
  server.kill("SIGINT");
  return new Promise<void>((r) => server.on("close", () => r()));
}
