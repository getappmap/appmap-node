const Database = require("better-sqlite3");

// pragma() runs its query through a statement of its own. Once the Statement
// prototype has been patched -- which the prepare() below does -- that inner
// statement must not be recorded on top of the pragma itself.
function main() {
  const db = new Database(":memory:");

  db.exec("CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
  db.prepare("SELECT count(*) AS n FROM people").get();

  db.pragma("journal_mode");
  // The simple form takes a different path inside better-sqlite3: pluck().get()
  // rather than all().
  db.pragma("user_version", { simple: true });

  db.close();
}

main();
