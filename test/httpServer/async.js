// A server started from inside an async function, with async request handlers
// that end the response from their own async context, requests that overlap
// and a streaming response that's aborted by the client.
const { createServer } = require("http");

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function handleBody(body) {
  return body.length;
}

async function handle(req, res) {
  if (req.url === "/body") {
    // read in listeners, which run after handle() is done
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => res.end(String(handleBody(body))));
    return;
  }
  if (req.url === "/stream") {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write("data: hello\n\n");
    // never ends, until the client goes away
    return;
  }
  await sleep(req.url === "/slow" ? 50 : 10);
  await sleep(5);
  res.end(req.url);
}

async function startServer() {
  const server = createServer((req, res) => void handle(req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

async function get(port, path, init) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, init);
  return response.text();
}

async function main() {
  const server = await startServer();
  const { port } = server.address();

  // optionally let the server's async context outlive asyncTrackingTimeout
  await sleep(parseInt(process.env.DELAY) || 0);

  await Promise.all([get(port, "/slow"), get(port, "/fast")]);
  await get(port, "/body", { method: "POST", body: "some body" });

  const controller = new AbortController();
  const stream = fetch(`http://127.0.0.1:${port}/stream`, { signal: controller.signal });
  await stream;
  controller.abort();
  await sleep(50);

  server.closeAllConnections();
  server.close();
}

void main();
