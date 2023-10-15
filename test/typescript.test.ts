import { integrationTest, readAppmap, runAppmapNode } from "./helpers";

integrationTest("mapping a simple script", () => {
  expect(runAppmapNode("yarn", "exec", "ts-node", "index.ts").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});
