import { integrationTest, readAppmaps, runAppmapNode } from "./helpers";

integrationTest("mapping Jest tests", () => {
  expect(runAppmapNode("yarn", "jest").status).toBe(1);
  expect(readAppmaps()).toMatchSnapshot();
});
