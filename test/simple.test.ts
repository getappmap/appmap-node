import { runAppmapNode, readAppmap, integrationTest, spawnAppmapNode } from "./helpers";

integrationTest("mapping a simple script", () => {
  expect(runAppmapNode("index.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("mapping an mjs script", () => {
  expect(runAppmapNode("index.mjs").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("mapping js class methods and constructors containing super keyword", () => {
  expect(runAppmapNode("class.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("forwarding signals to the child", async () => {
  const daemon = spawnAppmapNode("daemon.mjs");
  await new Promise<void>((r) =>
    daemon.stdout.on("data", (chunk: Buffer) => chunk.toString().includes("starting") && r()),
  );

  daemon.kill("SIGINT");
  await new Promise((r) => daemon.once("exit", r));

  expect(daemon.exitCode).toBe(42);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("mapping generator functions", () => {
  expect(runAppmapNode("generator.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});
