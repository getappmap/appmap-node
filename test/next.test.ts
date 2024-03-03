import { IncomingMessage, request } from "node:http";

import { integrationTest, readAppmaps, spawnAppmapNode } from "./helpers";

async function spawnNextJsApp() {
  // On Windows, we give "node" argument explicitly because next is a js file with
  // shebang (#!/usr/bin/env node) which does not work on Windows.
  const app =
    process.platform == "win32"
      ? spawnAppmapNode("node", "node_modules\\next\\dist\\bin\\next", "dev")
      : spawnAppmapNode("node_modules/next/dist/bin/next", "dev");

  await new Promise<void>((r) => {
    const onData = (chunk: Buffer) => {
      console.log("CHUNK", chunk.toString());
      if (chunk.toString().includes("Ready")) {
        app.stdout.removeListener("data", onData);
        r();
      }
    };
    app.stdout.on("data", onData);
  });
  return app;
}

integrationTest(
  "mapping a Next.js appmap",
  async () => {
    const app = await spawnNextJsApp();
    const response = await makeRequest("/hello");
    console.log("Response", response);
    const pid = parseInt((JSON.parse(response) as unknown as { pid: string }).pid);

    await makeRequest("/about");

    app.kill("SIGINT");
    await new Promise((r) => app.once("exit", r));
    const appMaps = readAppmaps();
    // Delete response body captures because they will be different in every run
    Object.values(appMaps).forEach(
      (a) =>
        a.events?.forEach((e) => {
          if ("http_server_response" in e) delete e.http_server_response.return_value;
          if ("http_client_response" in e) delete e.http_client_response.return_value;
        }),
    );

    expect(appMaps).toMatchSnapshot();

    // We need to kill the next process explicitly on Windows
    // because it's spawn-ed with "shell: true" and app is the shell process.
    if (process.platform == "win32") process.kill(pid, "SIGINT");
  },
  20000,
);

async function makeRequest(path: string, method = "GET") {
  const url = new URL(path, "http://localhost:3000");
  const response = new Promise<IncomingMessage>((resolve, reject) => {
    const req = request(url, { method }, resolve).once("error", reject);
    req.end();
  });

  const chunks: Buffer[] = [];
  for await (const chunk of await response) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString();
}
