import { integrationTest, readAppmaps, runAppmapNode } from "./helpers";

integrationTest("mapping Mocha tests", () => {
  runAppmapNode("./node_modules/mocha/bin/mocha.js");
  expect(readAppmaps()).toMatchSnapshot();
});
