// Two overlapping HTTP client requests; the one started first responds first,
// while the second is still in flight.
import { once } from "node:events";
import http from "node:http";

const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 27628;

let lastRequest;

function get(path) {
  return new Promise((resolve, reject) => {
    lastRequest = http
      .get(`http://localhost:${SERVER_PORT}${path}`, (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      })
      .on("error", reject);
  });
}

// Requests are recorded when they finish sending; wait for that so the order is stable.
const fast = get("/fast");
await once(lastRequest, "finish");
await Promise.all([fast, get("/slow")]);
