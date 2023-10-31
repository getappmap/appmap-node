import { integrationTest, readAppmap, runAppmapNode } from "./helpers";

integrationTest("mapping a simple script", () => {
  expect(runAppmapNode("yarn", "exec", "ts-node", "index.ts").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("mapping an mts script", () => {
  expect(runAppmapNode("yarn", "exec", "ts-node", "index.mts").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});
