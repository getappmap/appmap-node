const mysql = require("mysql");

const promisify = async (method, thisArg, ...args) => {
  return new Promise((resolve) => {
    method.call(thisArg, ...args, (error, result) => {
      // Since we don't have a MySQL server, we will
      // receive the error in every call. We intentionally
      // don't reject here.
      resolve(result);
    });
  });
};

const newConnection = () => mysql.createConnection({ host: "127.0.0.1" });

async function main() {
  for (const args of [
    ["SELECT 'Connection.query'"],
    ["SELECT 'Connection.query with values', ?, ?", [1, "ABC"]],
    [{ sql: "SELECT 'Connection.query with options'" }],
  ]) {
    // Create new connection for each query because we don't have
    // a MySQL server. We get a fatal error after calling the query
    // method second time in the same connection and we don't want to
    // have different exception events for first query (connect ECONNREFUSED 127.0.0.1:3306)
    // and the remaining queries (Cannot enqueue Query after fatal error)
    // in the appmap.
    const conn = newConnection();
    await promisify(conn.query, conn, ...args);
  }

  // We cannot test commands being called without a completion callback with promisify
  // because promisify already provides the completion callback to resolve the promise.
  // We test this case with no completion callback here without promisifying it.
  newConnection().query("SELECT 'Connection.query without a callback");
}

main();
