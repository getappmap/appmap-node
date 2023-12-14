/* eslint-disable @typescript-eslint/no-var-requires */
const pg = require("pg");

function main() {
  // Since we don't use a real database and we don't/can't connect to one,
  // query methods will thow exceptions. We discard the exceptions because
  // we are only testing if the query methods are patched for recording.
  // We can't record Pool.query without a real database because it uses
  // Client.query internally and it will throw before calling it in this case.

  new pg.Client().query("select * from customer where id = 1001").catch(() => {
    /* empty */
  });
  new pg.Client().query("select * from invoice where customer_id = 1001").catch(() => {
    /* empty */
  });

  const query = {
    text: "select * from user where id = $1",
    values: [1],
  };
  new pg.Client().query(query).catch(() => {
    /* empty */
  });
}

main();
