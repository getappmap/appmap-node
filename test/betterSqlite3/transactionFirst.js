const Database = require("better-sqlite3");

// The transaction controller compiles BEGIN, COMMIT and ROLLBACK on the native
// database handle, so they never pass through Database.prototype.prepare. When
// transaction() is the first thing an application does, BEGIN has already run
// by the time the callback prepares anything. It should be recorded anyway.
function main() {
  const db = new Database(":memory:");

  db.exec("CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");

  const insertMany = db.transaction((names) => {
    for (const name of names) db.prepare("INSERT INTO people (name) VALUES (?)").run(name);
  });
  insertMany(["alice"]);

  db.close();
}

main();
