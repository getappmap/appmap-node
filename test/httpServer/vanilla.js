const { createServer } = require("http");

const [PORT, HOST] = [parseInt(process.env.PORT) || 0, "127.0.0.1"];

const server = createServer().listen(PORT, HOST);

server
  .on("request", (req, res) => req.method === "GET" && res.writeHead(200).end())
  .on("request", (req, res) => req.method === "POST" && res.writeHead(204).end())
  .on("request", (req, res) => req.method === "DELETE" && res.writeHead(409).end())
  .on("listening", () => console.log("Server listening on %s:%s", HOST, server.address().port));

process.on("SIGINT", () => server.close());
