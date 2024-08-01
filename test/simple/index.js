/* eslint-disable @typescript-eslint/no-var-requires */
const assert = require("assert");
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

function argsInClosure() {
  // make sure "args" local is not shadowed by the instrumentation

  let args = 0;

  const incr = () => args++;

  incr();
  incr();
  assert.equal(args, 2);
}

function getDefaultA() {
  return 42;
}

function withDefault(a = getDefaultA()) {
  console.log("withDefault", a);
}

const withDefaultLambda = (a = getDefaultA()) => console.log("withDefaultLambda", a);

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
argsInClosure();

withDefault();
withDefaultLambda();
