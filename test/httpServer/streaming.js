// A long-running server whose requests should be written out to the process
// recording as they are done, rather than held back until the process exits.
// With LAYOUT=main the server is started from main(), which is still running
// when the requests come in, so they're written out inside it. Otherwise it's
// started from an async function which has returned by then, so the requests
// are written out at the root level, after main() -- which first needs to be
// given up on, see asyncTrackingTimeout.
const { createServer } = require("http");
const { readdirSync, readFileSync } = require("fs");

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function handle(req, res) {
  await sleep(20);
  res.end(req.url);
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

async function startServer() {
  const server = createServer((req, res) => void handle(req, res));
  await listen(server);
  return server;
}

function countWrittenRequests() {
  const dir = "tmp/appmap/process";
  const [part] = readdirSync(dir).filter((f) => f.endsWith(".part"));
  return readFileSync(`${dir}/${part}`, "utf8").split('"http_server_request"').length - 1;
}

async function makeRequests(port, count) {
  for (let i = 0; i < count; i++)
    await (await fetch(`http://127.0.0.1:${port}/request${i}`)).text();
}

async function main() {
  let server;
  if (process.env.LAYOUT == "main") {
    server = createServer((req, res) => void handle(req, res));
    await listen(server);
  } else server = await startServer();

  await sleep(150);
  await makeRequests(server.address().port, 10);
  await sleep(10); // let the last response close
  console.log("written requests: %d", countWrittenRequests());

  server.closeAllConnections();
  server.close();
}

void main();
