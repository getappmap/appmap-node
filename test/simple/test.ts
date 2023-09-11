import { testDir, runAppmapNode, readAppmap } from "../helpers";

testDir(__dirname);

test("mapping a simple script", () => {
  runAppmapNode("index.js");
  expect(readAppmap()).toMatchSnapshot();
});
