import { integrationTest, readAppmaps, runAppmapNode } from "./helpers";

integrationTest("mapping Jest tests", () => {
  expect(runAppmapNode("yarn", "jest", "--color").status).toBe(1);
  expect(readAppmaps()).toMatchSnapshot();
});
