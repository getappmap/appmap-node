// Calls made from the async context of a function after it's done end up next to
// it, whether or not it's been written out yet. With BLOCK set, it isn't, as an
// unrelated function called before it is still running.
const sleep = (ms) => new Promise((resolve) => globalThis.setTimeout(resolve, ms));

async function blocker() {
  await sleep(100);
}

function late() {
  return "late";
}

async function done() {
  globalThis.setTimeout(() => late(), 20);
}

if (process.env.BLOCK) blocker();
done();
