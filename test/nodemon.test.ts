import { integrationTest, readAppmap, spawnAppmapNode } from "./helpers";

integrationTest("esm-loader is loaded when required", async () => {
  const server = spawnAppmapNode("node_modules/nodemon/bin/nodemon.js", "index.ts");
  await new Promise<void>((r) =>
    server.stdout.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("RESOLVE")) r();
    }),
  );

  server.kill("SIGINT");
  await new Promise((r) => server.once("exit", r));

  expect(readAppmap()).toMatchSnapshot();
});
