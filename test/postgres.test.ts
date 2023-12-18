import { join } from "node:path";

import { readAppmap, runAppmapNode, testDir } from "./helpers";

testDir(join(__dirname, "postgres"));

// To run these tests, set POSTGRES_URL to a url such as
// socket:/var/run/postgresql or
// postgres://postgres.host.example
const integrationTest = process.env.POSTGRES_URL ? test : test.skip;

integrationTest("mapping PostgreSQL tests", () => {
  expect(runAppmapNode("index.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});
