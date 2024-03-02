const http = require("node:http");

const SERVER_PORT = 27628;
const TEST_HEADER_VALUE = "This test header is added after ClientRequest creation";

const consume = (request) => {
  return new Promise((resolve) => {
    request.on("response", (response) => {
      response.on("data", () => {
        return;
      });
      response.on("end", resolve);
    });
    request.end();
  });
};

async function makeRequests() {
  const r1 = new http.ClientRequest(`http://localhost:${SERVER_PORT}/endpoint/one`);
  r1.appendHeader("test-header", TEST_HEADER_VALUE);
  await consume(r1);

  const r2 = http.request({
    hostname: "localhost",
    port: SERVER_PORT,
    path: "/endpoint/two?p1=v1&p2=v2",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  await consume(r2);

  const r3 = http.get(`http://localhost:${SERVER_PORT}/endpoint/three`);
  await consume(r3);

  const j1 = http.get(`http://localhost:${SERVER_PORT}/endpoint/json/one`);
  await consume(j1);

  const j2 = http.get(`http://localhost:${SERVER_PORT}/endpoint/json/two`);
  await consume(j2);
}

function mocked() {
  const nock = require("nock");
  const n = nock(`http://localhost:${SERVER_PORT}`);
  n.get("/endpoint/one").reply(200, "Hello World!");
  n.post("/endpoint/two?p1=v1&p2=v2").reply(200, "Hello World!");
  n.get("/endpoint/three").reply(404, undefined, { "Content-Type": "text/html" });

  n.get("/endpoint/json/one").reply(200, undefined, { "Content-Type": "application/json" });
  n.get("/endpoint/json/two").reply(200, undefined, { "Content-Type": "application/json" });
  void makeRequests();
}

if (process.argv.includes("--mock")) mocked();
else makeRequests();
