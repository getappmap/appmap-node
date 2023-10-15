import { runAppmapNode, readAppmap, integrationTest } from "./helpers";

integrationTest("mapping a simple script", () => {
  expect(runAppmapNode("index.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});
