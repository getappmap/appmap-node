import http, { ClientRequest } from "node:http";

export const SERVER_PORT = 27628;
export const TEST_HEADER_VALUE = "This test header is added after ClientRequest creation";

const consume = (request: ClientRequest) => {
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
}

async function mocked() {
  const nock = (await import("nock")).default;
  const n = nock(`http://localhost:${SERVER_PORT}`);
  n.get("/endpoint/one").reply(200, "Hello World!");
  n.post("/endpoint/two?p1=v1&p2=v2").reply(200, "Hello World!");
  n.get("/endpoint/three").reply(404, undefined, { "Content-Type": "text/html" });
  void makeRequests();
}

if (process.argv.includes("--mock")) void mocked();
else void makeRequests();
