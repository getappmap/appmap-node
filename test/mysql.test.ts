import { integrationTest, readAppmap, runAppmapNode } from "./helpers";

integrationTest("mapping MySQL tests", () => {
  expect(runAppmapNode("index.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});
