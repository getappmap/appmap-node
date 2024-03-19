/* eslint-disable @typescript-eslint/no-var-requires */
const assert = require("node:assert");
const { record } = require("../../dist/facade");

function hello(message) {
  console.log("hello", message);
}

async function main() {
  hello("darkness my old friend");

  const appmap1 = record(() => {
    hello("world");
  });

  hello("123");

  assert(appmap1.events.filter((e) => e.event == "call").length == 1);

  const appmap2 = await record(async () => {
    hello("world async");
  });

  hello("x");
  hello("y");
  hello("z");

  assert(appmap2.events.filter((e) => e.event == "call").length == 1);
}

main();
