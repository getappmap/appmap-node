/* eslint-disable @typescript-eslint/no-var-requires */
const pg = require("pg");

const connectionString = process.env.POSTGRES_URL;

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const pool = new pg.Pool({ connectionString });

  await client.query("select * from pg_config where name = 'BINDIR'");
  await pool.query("select * from pg_config where name = 'DOCDIR'");

  const query = {
    text: "select * from pg_config where name = $1",
    values: ["LIBDIR"],
  };
  await client.query(query);

  pool.end();
  client.end();
}

main();
