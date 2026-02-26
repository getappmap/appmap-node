const { setTimeout } = require("timers/promises");

function foo(x) {
  skipped();
  return x * 2;
}

async function promised(ok = true) {
  await setTimeout(10);
  if (!ok) throws();
  return "promised return";
}

function immediatePromise() {
  return Promise.resolve("immediate");
}

function throws() {
  console.log("going to throw");
  throw new Error("throws intentionally");
}

function skipped() {
  console.log("skipped");
}

try {
  throws();
  console.log(foo(43));
} catch {
  console.log(foo(44));
}

console.log(foo(42));
promised().then(console.log);
promised(false).catch(console.log);
immediatePromise().then(console.log);
