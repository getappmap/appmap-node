import assert from "node:assert";

import type * as AppMap from "../src/AppMap";
import { integrationTest, readAppmap, runAppmapNode } from "./helpers";

integrationTest("mapping better-sqlite3 calls", () => {
  expect(runAppmapNode("index.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("recording an iterator that outlives a failed call", () => {
  expect(runAppmapNode("iterateBusyFailure.js").status).toBe(0);

  // The iterated query is still recorded once, and it succeeded: the failure
  // was the settle() call, which left the iteration running.
  expect(recordedQueries()).toEqual([
    "CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
    "INSERT INTO people (name) VALUES ('alice'), ('bob'), ('carol')",
    "SELECT name FROM people ORDER BY id",
    "SELECT settle() AS done",
  ]);

  expect(outcomeOf("SELECT name FROM people ORDER BY id")?.exceptions).toBeUndefined();
  expect(outcomeOf("SELECT settle() AS done")?.exceptions).toMatchObject([
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

integrationTest("recording how a transaction ends", () => {
  expect(runAppmapNode("transactionOutcomes.js").status).toBe(0);
  const insert = "INSERT INTO people (name) VALUES (?)";
  expect(recordedQueries()).toEqual([
    "CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL)",
    // A callback that throws rolls back.
    "BEGIN",
    insert,
    "ROLLBACK",
    // A transaction nested in another runs on a savepoint. The savepoint's
    // name is better-sqlite3's own business, so only the statement is pinned.
    "BEGIN",
    insert,
    expect.stringMatching(/^SAVEPOINT /) as string,
    insert,
    expect.stringMatching(/^RELEASE /) as string,
    "COMMIT",
    "SELECT name FROM people ORDER BY id",
  ]);
  expect(outcomeOf("ROLLBACK")?.exceptions).toBeUndefined();
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
  return queryEvents().map((event) => event.sql_query.sql);
}

// The event that ends the given query, whether it returned or threw.
function outcomeOf(sql: string): AppMap.FunctionReturnEvent | undefined {
  const query = queryEvents().find((event) => event.sql_query.sql === sql);
  assert(query, `no query event for ${sql}`);
  return (readAppmap().events ?? []).find(
    (event): event is AppMap.FunctionReturnEvent =>
      "parent_id" in event && event.parent_id === query.id,
  );
}

function queryEvents(): AppMap.SqlQueryEvent[] {
  return (readAppmap().events ?? []).filter(
    (event): event is AppMap.SqlQueryEvent => "sql_query" in event,
  );
}
