import { type IncomingMessage, request, OutgoingMessage } from "node:http";

import { fixAppmap, integrationTest, readAppmaps, spawnAppmapNode } from "./helpers";
import { ChildProcessWithoutNullStreams } from "child_process";

integrationTest("mapping Express.js requests", async () => {
  expect.assertions(1);
  const server = await spawnServer("express.js");
  await makeRequests();
  await killServer(server);
  expect(readAppmaps()).toMatchSnapshot();
});

integrationTest("mapping node:http requests", async () => {
  expect.assertions(1);
  const server = await spawnServer("vanilla.js");
  await makeRequests();
  await killServer(server);
  expect(readAppmaps()).toMatchSnapshot();
});

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

async function spawnServer(script: string) {
  const server = spawnAppmapNode(script);
  await new Promise<void>((r) =>
    server.stdout.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("listening")) r();
    }),
  );
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
