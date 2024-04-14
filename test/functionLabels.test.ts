import { integrationTest, readAppmap, runAppmapNode } from "./helpers";

integrationTest("mapping labeled functions", () => {
  expect(runAppmapNode("index.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("mapping labeled functions - TypeScript", () => {
  expect(runAppmapNode("yarn", "exec", "ts-node", "index.ts").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});
