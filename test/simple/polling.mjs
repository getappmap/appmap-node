// A long-running polling loop, which is never done, with something else going on
// in the meantime. That should be written out once the loop is given up on, even
// though there's always a fresh tick() pending inside it.
import { readdirSync, readFileSync } from "node:fs";

const sleep = (ms) => new Promise((resolve) => globalThis.setTimeout(resolve, ms));

async function tick() {
  await sleep(10);
}

async function poll() {
  for (let i = 0; i < 50; i++) await tick();
}

function work() {
  return "working";
}

function countWritten(method) {
  const dir = "tmp/appmap/process";
  const [part] = readdirSync(dir).filter((f) => f.endsWith(".part"));
  return readFileSync(`${dir}/${part}`, "utf8").split(`"method_id":"${method}"`).length - 1;
}

poll();
const interval = globalThis.setInterval(work, 20);
await sleep(300);
globalThis.clearInterval(interval);
console.log("written work calls: %d", countWritten("work"));
