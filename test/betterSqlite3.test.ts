import assert from "node:assert";

import type * as AppMap from "../src/AppMap";
import { integrationTest, readAppmap, runAppmapNode } from "./helpers";

integrationTest("mapping better-sqlite3 calls", () => {
  expect(runAppmapNode("index.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("recording an iterator whose cleanup fails", () => {
  expect(runAppmapNode("iterateCleanupFailure.js").status).toBe(0);

  const events = readAppmap().events ?? [];
  const iterated = events.find(
    (event): event is AppMap.SqlQueryEvent =>
      "sql_query" in event && event.sql_query.sql.startsWith("SELECT name"),
  );
  assert(iterated);

  const settled = events.find(
    (event): event is AppMap.FunctionReturnEvent =>
      "parent_id" in event && event.parent_id === iterated.id,
  );
  expect(settled?.exceptions).toMatchObject([
    { class: "TypeError", message: expect.stringContaining("busy") as string },
  ]);
});
