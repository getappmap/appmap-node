/* eslint-disable @typescript-eslint/no-var-requires */
const { setTimeout } = require("timers/promises");

function foo(x) {
  return x * 2;
}

async function promised() {
  await setTimeout(100);
  return "promised return";
}

function immediatePromise() {
  return Promise.resolve("immediate");
}

function throws() {
  console.log("going to throw");
  throw new Error("throws intentionally");
}

try {
  throws();
  console.log(foo(43));
} catch {
  console.log(foo(44));
}

console.log(foo(42));
promised().then(console.log);
immediatePromise().then(console.log);
