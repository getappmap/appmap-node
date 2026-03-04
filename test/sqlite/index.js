const sqlite = require("sqlite3");
const { setTimeout } = require("node:timers/promises");

const promisify = (method, thisArg, ...args) =>
  new Promise((resolve, reject) => {
    method.call(thisArg, ...args, (error, result) => {
      if (error) reject(error);
      resolve(result);
    });
  });

async function main() {
  const db = new sqlite.Database(":memory:");

  for (const item of [
    [sqlite.Database.prototype.run, "run"],
    [sqlite.Database.prototype.all, "all"],
    [sqlite.Database.prototype.get, "get"],
    [sqlite.Database.prototype.exec, "exec"],
  ]) {
    const [method, name] = item;
    await promisify(method, db, `SELECT 'Database.${name}'`);
  }

  // each() takes an optional row callback followed by a completion callback.
  // Pass undefined for the row callback so promisify's callback lands in the
  // completion slot, ensuring functionReturn is recorded before the promise resolves.
  await promisify(sqlite.Database.prototype.each, db, `SELECT 'Database.each'`, undefined);

  await promisify(
    sqlite.Database.prototype.each,
    db,
    "SELECT 'Database.each with row callback'",
    (...args) => console.log("row callback args:", args),
  );
  await promisify(
    sqlite.Database.prototype.run,
    db,
    `SELECT 'Database.run with params', ? AS a, ? AS b`,
    1,
    2,
  );
  await promisify(
    sqlite.Database.prototype.run,
    db,
    "SELECT 'Database.run with object param', $foo, $bar",
    {
      $foo: 123,
      $bar: "abc",
    },
  );

  for (const item of [
    [sqlite.Statement.prototype.run, "run"],
    [sqlite.Statement.prototype.all, "all"],
    [sqlite.Statement.prototype.get, "get"],
  ]) {
    const [method, name] = item;
    const st = db.prepare(`SELECT 'Statement.${name}'`);
    await promisify(method, st);
    st.finalize();
  }

  const stEach = db.prepare(`SELECT 'Statement.each'`);
  await promisify(sqlite.Statement.prototype.each, stEach, undefined);
  stEach.finalize();

  // Same statement twice should produce two sql events in appmap.
  const st = db.prepare(`SELECT 'Statement.run - prepare once run twice'`);
  await promisify(sqlite.Statement.prototype.run, st);
  await promisify(sqlite.Statement.prototype.run, st);
  st.finalize();

  // We cannot test commands being called without a completion callback with promisify
  // because promisify already provides the completion callback to resolve the promise.
  // We test this case with no completion callback here wtihout promisifying them.
  db.run("SELECT 'Database.run without a completion callback'");
  await setTimeout(50); // to serialize the appmap
  db.prepare("SELECT 'Statement.run without a completion callback'").run().finalize();
}

main();
