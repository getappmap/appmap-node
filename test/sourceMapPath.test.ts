import { integrationTest, readAppmap, runAppmapNode } from "./helpers";

integrationTest("mapping a bundled script", () => {
  expect(runAppmapNode("./built/index.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});
