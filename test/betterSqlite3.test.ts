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

integrationTest("recording queries when the module is required more than once", () => {
  expect(runAppmapNode("doubleRequire.js").status).toBe(0);
  expect(recordedQueries()).toEqual([
    "CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
    "PRAGMA journal_mode",
    "INSERT INTO people (name) VALUES (?)",
  ]);
});

integrationTest("recording a transaction started before any prepared statement", () => {
  expect(runAppmapNode("transactionFirst.js").status).toBe(0);
  expect(recordedQueries()).toEqual([
    "CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
    "BEGIN",
    "INSERT INTO people (name) VALUES (?)",
    "COMMIT",
  ]);
});

integrationTest("recording a pragma run after a prepared statement", () => {
  expect(runAppmapNode("pragmaAfterPrepare.js").status).toBe(0);
  expect(recordedQueries()).toEqual([
    "CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
    "SELECT count(*) AS n FROM people",
    "PRAGMA journal_mode",
    "PRAGMA user_version",
  ]);
});

integrationTest("leaving the shape of an iterator alone", () => {
  expect(runAppmapNode("iteratorShape.js").status).toBe(0);
  expect(recordedQueries()).toEqual([
    "CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
    "INSERT INTO people (name) VALUES ('alice'), ('bob')",
    "SELECT name FROM people ORDER BY id",
  ]);
});

function recordedQueries(): string[] {
  return (readAppmap().events ?? [])
    .filter((event): event is AppMap.SqlQueryEvent => "sql_query" in event)
    .map((event) => event.sql_query.sql);
}
