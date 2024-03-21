import { integrationTest, readAppmaps, runAppmapNode } from "./helpers";

integrationTest("mapping Jest tests", () => {
  expect(runAppmapNode("yarn", "jest", "test", "--color").status).toBe(1);
  expect(runAppmapNode("yarn", "jest", "asyncLib", "--color").status).toBe(0);
  expect(readAppmaps()).toMatchSnapshot();
});
