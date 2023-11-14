import { integrationTest, readAppmaps, runAppmapNode } from "./helpers";

integrationTest("mapping Mocha tests", () => {
  expect(runAppmapNode("yarn", "mocha").status).toBeGreaterThan(0);
  expect(readAppmaps()).toMatchSnapshot();
});
