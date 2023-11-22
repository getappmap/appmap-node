// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite = require("sqlite3");

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
    [sqlite.Database.prototype.each, "each"],
    [sqlite.Database.prototype.exec, "exec"],
  ]) {
    const [method, name] = item;
    await promisify(method, db, `SELECT 'Database.${name}'`);
  }

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
    [sqlite.Statement.prototype.each, "each"],
  ]) {
    const [method, name] = item;
    const st = db.prepare(`SELECT 'Statement.${name}'`);
    await promisify(method, st);
    st.finalize();
  }

  // Same statement twice should produce two sql events in appmap.
  const st = db.prepare(`SELECT 'Statement.run - prepare once run twice'`);
  await promisify(sqlite.Statement.prototype.run, st);
  await promisify(sqlite.Statement.prototype.run, st);
  st.finalize();

  // We cannot test commands being called without a completion callback with promisify
  // because promisify already provides the completion callback to resolve the promise.
  // We test this case with no completion callback here wtihout promisifying them.
  // We are serializing them just to get the same [id, parent_id] pairs
  // for the events in the appmap snapshot in every test run.
  db.serialize(
    function () {
      db.run("SELECT 'Database.run without a completion callback'");
      db.prepare("SELECT 'Stetement.run without a completion callback'").run().finalize();
    },
    () => db.close(),
  );
}

main();
