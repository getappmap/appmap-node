import { integrationTest, readAppmaps, runAppmapNode } from "./helpers";

integrationTest("mapping Jest tests", () => {
  runAppmapNode("yarn", "jest");
  expect(readAppmaps()).toMatchSnapshot();
});
