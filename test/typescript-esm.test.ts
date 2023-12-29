import { integrationTest, readAppmap, runAppmapNode } from "./helpers";

integrationTest("esm-loader is loaded when required", () => {
  expect(runAppmapNode("node", "--loader", "ts-node/esm", "index.ts").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});
