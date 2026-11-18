// The same async function called twice, the second time after more than the async
// tracking timeout, should be recorded the same way both times (see #251).
const sleep = (ms) => new Promise((resolve) => globalThis.setTimeout(resolve, ms));

function prepare() {
  return "ready";
}

function finish(value) {
  return value.toUpperCase();
}

async function load() {
  const value = prepare();
  await sleep(10);
  return finish(value);
}

await load();
await sleep(150);
await load();
