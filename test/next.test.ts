import { IncomingMessage, request } from "http";

import { integrationTest, readAppmaps, spawnAppmapNode } from "./helpers";

async function spawnNextJsApp() {
  const app = spawnAppmapNode("node_modules/next/dist/bin/next", "dev");
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

    app.kill("SIGINT");
    await new Promise((r) => app.once("exit", r));

    expect(readAppmaps()).toMatchSnapshot();
  },
  10000,
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
