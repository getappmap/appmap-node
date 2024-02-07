import { integrationTest, readAppmap, runAppmapNode } from "./helpers";

// To run these tests, set MONGODB_URI to a url such as mongodb://localhost:27017
const test = integrationTest.if(!!process.env.MONGODB_URI);

test("mapping MongoDB tests", () => {
  expect(runAppmapNode("index.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});
