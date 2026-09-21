const Database = require("better-sqlite3");

// A second require is a cache hit, but the require hook still runs for it.
// Patching must not stack: each query below is one query, however many times
// the application asked for the module.
require("better-sqlite3");

function main() {
  const db = new Database(":memory:");

  db.exec("CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
  db.pragma("journal_mode");
  db.prepare("INSERT INTO people (name) VALUES (?)").run("alice");

  db.close();
}

main();
