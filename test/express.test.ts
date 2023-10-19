import { request } from "node:http";
import { integrationTest, readAppmap, spawnAppmapNode } from "./helpers";

integrationTest("mapping Express.js requests", async () => {
  expect.assertions(2);
  const server = spawnAppmapNode("index.js");
  await new Promise<void>((r) =>
    server.stdout.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("listening")) r();
    }),
  );
  await new Promise<void>((r) => request("http://localhost:27627").end().on("close", r));
  await new Promise<void>((r) =>
    request("http://localhost:27627/nonexistent").end().on("close", r),
  );
  server.kill("SIGINT");
  await new Promise<void>((r) => server.on("close", () => r()));
  expect(readAppmap()).toMatchSnapshot();
});
