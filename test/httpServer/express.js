const express = require("express");

const app = express();
const port = 27627;

app.get("/", helloWorld);
app.get("/api/:ident", (req, res) => {
  res.json(api(req.query));
});

app.post("/api/:ident", express.json(), (req, res) => {
  res.json(postApi(req.body));
});

const server = app.listen(port, "127.0.0.1", () => {
  console.log(`Example app listening on port ${port}`);
});

process.on("SIGINT", () => server.close());

function helloWorld(req, res) {
  res.send("Hello World!");
}

function api(query) {
  return { api: "result", ...query };
}

function postApi(body) {
  return body;
}
