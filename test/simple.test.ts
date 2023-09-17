import { runAppmapNode, readAppmap, integrationTest } from "./helpers";

integrationTest("mapping a simple script", () => {
  runAppmapNode("index.js");
  expect(readAppmap()).toMatchSnapshot();
});
