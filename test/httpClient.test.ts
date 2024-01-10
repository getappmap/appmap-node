import http from "node:http";

import { integrationTest, readAppmap, runAppmapNode, spawnAppmapNode } from "./helpers";

export const SERVER_PORT = 27628;
export const TEST_HEADER_VALUE = "This test header is added after ClientRequest creation";

integrationTest("mapping http client requests", async () => {
  const server = http
    .createServer(function (req, res) {
      if (req.url?.startsWith("/endpoint/one") ?? req.url?.startsWith("endpoint/two")) {
        res.write("Hello World!");
        res.end();
      } else {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end();
      }
    })
    .listen(SERVER_PORT);
  const client = spawnAppmapNode("index.js");
  await new Promise<void>((r) => client.on("close", () => r()));
  server.close();
  const appMap = readAppmap();

  // Make sure we capture the headers modified/added after ClientRequest creation.
  expect(JSON.stringify(appMap.events)).toContain(TEST_HEADER_VALUE);
  expect(appMap).toMatchSnapshot();
});

integrationTest("mapping mocked http client requests", () => {
  expect(runAppmapNode("index.js", "--mock").status).toBe(0);
  const appMap = readAppmap();

  // Make sure we capture the headers modified/added after ClientRequest creation.
  expect(JSON.stringify(appMap.events)).toContain(TEST_HEADER_VALUE);
  expect(appMap).toMatchSnapshot();
});

integrationTest("mapping a Jest test", () => {
  expect(runAppmapNode("yarn", "jest").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});
