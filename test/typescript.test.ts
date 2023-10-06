import { integrationTest, readAppmap, runAppmapNode } from "./helpers";

integrationTest("mapping a simple script", () => {
  runAppmapNode("yarn", "exec", "ts-node", "index.ts");
  expect(readAppmap()).toMatchSnapshot();
});
