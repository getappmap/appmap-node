const Database = require("better-sqlite3");

// better-sqlite3 refuses to release an iterator while the connection is busy,
// so iterator.return() throws if it is reached from inside a user-defined
// function running as part of another query. Contrived, but it is the only way
// to make cleanup fail: the query being iterated ends there, and it ends badly,
// so it should be recorded as an exception rather than a plain return.
function main() {
  const db = new Database(":memory:");

  db.exec("CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
  db.exec("INSERT INTO people (name) VALUES ('alice'), ('bob')");

  let iterator;
  db.function("cleanup", () => {
    iterator.return();
    return "unreachable";
  });

  iterator = db.prepare("SELECT name FROM people ORDER BY id").iterate();
  console.log("first row:", iterator.next().value.name);

  try {
    db.prepare("SELECT cleanup() AS done").get();
  } catch (error) {
    console.log("caught:", error.message);
  }
}

main();
