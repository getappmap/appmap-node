const assert = require("node:assert");

const Database = require("better-sqlite3");

// Recording iterate() must not change what the iterator looks like to the
// application. better-sqlite3 hands back a StatementIterator carrying a frozen
// reference to the statement it came from, and anything reached through it
// still has to work.
function main() {
  const db = new Database(":memory:");

  db.exec("CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
  db.exec("INSERT INTO people (name) VALUES ('alice'), ('bob')");

  const statement = db.prepare("SELECT name FROM people ORDER BY id");
  const iterator = statement.iterate();

  assert.strictEqual(iterator.statement, statement);
  assert.strictEqual(iterator.constructor.name, "StatementIterator");
  // for..of asks the iterator for itself, and must get something we record.
  assert.strictEqual(iterator[Symbol.iterator](), iterator);

  const names = [];
  for (const row of iterator) names.push(row.name);
  assert.deepStrictEqual(names, ["alice", "bob"]);

  // Asking a spent iterator for more, or settling it again, is a no-op in
  // better-sqlite3 -- and must not record the query a second time either.
  assert.strictEqual(iterator.next().done, true);
  assert.strictEqual(iterator.return().done, true);

  db.close();
}

main();
