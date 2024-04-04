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
  const server = await spawnServer("express.js");
  await makeRequests();
  // Wait for the last request to finish
  await awaitStdoutOnData(server, "api-bar.appmap.json");
  await killServer(server);
  expect(readAppmaps()).toMatchSnapshot();
});

integrationTest("mapping node:http requests", async () => {
  expect.assertions(1);
  const server = await spawnServer("vanilla.js");
  await makeRequests();
  // Wait for the last request to finish
  await awaitStdoutOnData(server, "api-bar.appmap.json");
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
    const server = await spawnServer("vanilla.js", {
      env: { ...process.env, APPMAP_RECORDER_PROCESS_ALWAYS: "true" },
    });
    await makeRequests();
    // Wait for the last request to finish
    await awaitStdoutOnData(server, "api-bar.appmap.json");
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
  const server = await spawnServer("express.js");
  await makeRequest("/_appmap/record", "POST");
  await makeRequests();
  const appmap = JSON.parse(await makeRequest("/_appmap/record", "DELETE")) as unknown;
  expect(fixAppmap(appmap)).toMatchSnapshot();
  await killServer(server);
});

integrationTest("mapping node:http requests with remote recording", async () => {
  expect.assertions(1);
  const server = await spawnServer("vanilla.js");
  await makeRequest("/_appmap/record", "POST");
  await makeRequests();
  const appmap = JSON.parse(await makeRequest("/_appmap/record", "DELETE")) as unknown;
  expect(fixAppmap(appmap)).toMatchSnapshot();
  await killServer(server);
});

async function awaitStdoutOnData(server: ChildProcessWithoutNullStreams, searchString: string) {
  await new Promise<void>((r) =>
    server.stdout.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes(searchString)) r();
    }),
  );
}

async function makeRequests() {
  await makeRequest("");
  await makeRequest("/nonexistent");
  await makeRequest("/api/foo?param1=3&param2=4");
  await makeRequest("/api/bar", "POST", (req) => {
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
  await awaitStdoutOnData(server, "listening");
  return server;
}

async function makeRequest(
  path: string,
  method = "GET",
  prepare?: (req: OutgoingMessage) => void,
): Promise<string> {
  const url = new URL(path, "http://127.0.0.1:27627");
  const response = new Promise<IncomingMessage>((resolve, reject) => {
    const req = request(url, { method }, resolve).once("error", reject);
    if (prepare) prepare(req);
    req.end();
  });
  const chunks: Buffer[] = [];
  for await (const chunk of await response) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString();
}

function killServer(server: ChildProcessWithoutNullStreams) {
  server.kill("SIGINT");
  return new Promise<void>((r) => server.on("close", () => r()));
}
