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

    let appMaps = readAppmaps();
    // Some parts get serialized differently in node v18, fix them
    // to match v20 & v21.
    const [major] = process.versions.node.split(".").map(Number);
    if (major == 18) {
      const appMapStr = JSON.stringify(appMaps)
        .replaceAll("_HeadersList", "HeadersList")
        .replaceAll("url: [URL]", "url: URL {}")
        .replaceAll("url: {}", "url: URL {}");
      appMaps = JSON.parse(appMapStr) as ReturnType<typeof readAppmaps>;
    }

    expect(appMaps).toMatchSnapshot();
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
