import http from "http";

const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 27628;
export const TEST_HEADER_VALUE = "This test header is added after ClientRequest creation";

export default async function makeRequest() {
  const request = new http.ClientRequest(`http://localhost:${SERVER_PORT}/endpoint/one`);
  request.appendHeader("test-header", TEST_HEADER_VALUE);
  await new Promise((resolve) => {
    request.on("response", (response) => {
      response.on("data", () => {
        return;
      });
      response.on("end", resolve);
    });
    request.end();
  });
}

makeRequest();
