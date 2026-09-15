import { integrationTest, readAppmap, runAppmapNode } from "./helpers";

integrationTest("mapping better-sqlite3 calls", () => {
  expect(runAppmapNode("index.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});
