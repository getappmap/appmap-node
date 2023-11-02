const express = require("express");
const app = express();
const port = 27627;

app.get("/", helloWorld);
app.get("/api", (req, res) => {
  res.json(api(req.query));
});

const server = app.listen(port, "localhost", () => {
  console.log(`Example app listening on port ${port}`);
});

process.on("SIGINT", () => server.close());

function helloWorld(req, res) {
  res.send("Hello World!");
}

function api(query) {
  return { api: "result", ...query };
}
