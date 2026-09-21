const assert = require("node:assert");

const Database = require("better-sqlite3");

// The transaction controller compiles a statement for every way a transaction
// can end, not just BEGIN and COMMIT: a callback that throws rolls back, and a
// transaction nested inside another runs on a savepoint. None of them go
// through prepare(), so all of them depend on the Statement patch being in
// place before the controller is built.
function main() {
  const db = new Database(":memory:");

  db.exec("CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
  const insert = db.prepare("INSERT INTO people (name) VALUES (?)");

  const failing = db.transaction((name) => {
    insert.run(name);
    throw new Error("changed my mind");
  });
  assert.throws(() => failing("alice"), /changed my mind/);

  const inner = db.transaction((name) => insert.run(name));
  const outer = db.transaction((name) => {
    insert.run(name);
    inner(`${name} jr`);
  });
  outer("bob");

  assert.deepStrictEqual(
    db
      .prepare("SELECT name FROM people ORDER BY id")
      .all()
      .map((row) => row.name),
    ["bob", "bob jr"],
  );

  db.close();
}

main();
