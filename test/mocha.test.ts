import { integrationTest, readAppmaps, runAppmapNode } from "./helpers";

integrationTest("mapping Mocha tests", () => {
  expect(runAppmapNode("yarn", "mocha").status).toBe(1);
  expect(readAppmaps()).toMatchSnapshot();
});
