// A query that takes longer than the async tracking timeout, with something else
// going on in the meantime, and one which fails.
const sqlite3 = require("sqlite3");

const db = new sqlite3.Database(":memory:");

function query(sql) {
  return new Promise((resolve) => db.all(sql, (err, rows) => resolve(err ?? rows)));
}

function work() {
  return "working";
}

async function main() {
  await query(
    "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 1000000) SELECT count(*) FROM c",
  );
  await query("SELECT json('not json')");
}

const interval = setInterval(work, 20);
main().finally(() => clearInterval(interval));
