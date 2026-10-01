// Two overlapping HTTP client requests; the one started first responds first,
// while the second is still in flight.
import http from "node:http";

const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 27628;

function get(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`http://localhost:${SERVER_PORT}${path}`, (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      })
      .on("error", reject);
  });
}

await Promise.all([get("/fast"), get("/slow")]);
