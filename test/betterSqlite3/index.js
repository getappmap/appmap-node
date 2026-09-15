const Database = require("better-sqlite3");

// better-sqlite3 is synchronous: every call below returns before the next line
// runs, so each sql_query event should be followed directly by its return.
function main() {
  const db = new Database(":memory:");

  db.exec("CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
  db.pragma("journal_mode");

  // The same prepared statement run twice should produce two sql events.
  const insert = db.prepare("INSERT INTO people (name) VALUES (?)");
  insert.run("alice");
  insert.run("bob");

  db.prepare("SELECT name FROM people WHERE id = ?").get(1);
  db.prepare("SELECT id, name FROM people ORDER BY id").all();

  // iterate() finishes when the iterator is exhausted...
  for (const row of db.prepare("SELECT name FROM people ORDER BY id").iterate()) {
    console.log("row:", row.name);
  }
  // ...or when the loop leaves early.
  for (const row of db.prepare("SELECT name FROM people ORDER BY id").iterate()) {
    console.log("first row only:", row.name);
    break;
  }

  // Statements run inside a transaction are recorded like any other.
  const insertMany = db.transaction((names) => {
    for (const name of names) insert.run(name);
  });
  insertMany(["carol", "dave"]);

  // A failing statement is recorded as an exception and still thrown.
  try {
    db.prepare("INSERT INTO people (id, name) VALUES (1, 'duplicate')").run();
  } catch (error) {
    console.log("caught:", error.code);
  }

  db.close();
}

main();
