const assert = require("node:assert");

const Database = require("better-sqlite3");

// better-sqlite3 refuses to touch an iterator while the connection is busy,
// and that check comes before it looks at the iterator at all: nothing is
// released, and the rows are still to come. A call that fails this way must
// not end the recording of the query -- neither as a failure nor as a
// success -- because the query is still running.
function main() {
  const db = new Database(":memory:");

  db.exec("CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
  db.exec("INSERT INTO people (name) VALUES ('alice'), ('bob'), ('carol')");

  let iterator;
  db.function("settle", () => {
    iterator.return();
    return "unreachable";
  });

  iterator = db.prepare("SELECT name FROM people ORDER BY id").iterate();
  assert.strictEqual(iterator.next().value.name, "alice");

  // Reached from inside a query of its own, so the connection is busy.
  assert.throws(() => db.prepare("SELECT settle() AS done").get(), /busy/);

  // The failed settle left the iteration running: the rest of the rows still
  // come through, and only then is the query over.
  assert.deepStrictEqual(
    [...iterator].map((row) => row.name),
    ["bob", "carol"],
  );

  db.close();
}

main();
