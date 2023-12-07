const http = require("node:http");
const nock = require("nock");

function mock() {
  nock("http://localhost:3000").get("/").twice().reply(200);
  // request "finished" callback will be registered inside httpHook
  // but it (callback) won't be called before the test finishes.
  http.get("http://localhost:3000/");
}

describe("jest recording finished", () => {
  it("is checked in request finish callback", mock);

  // This makes it easier to understand that request "finish" callback
  // will be called after the test finishes.
  afterEach(() => http.get("http://localhost:3000/"));
});
