const express = require("express");
const app = express();
const port = 27627;

app.get("/", helloWorld);

const server = app.listen(port, "localhost", () => {
  console.log(`Example app listening on port ${port}`);
});

process.on("SIGINT", () => server.close());

function helloWorld(req, res) {
  res.send("Hello World!");
}
