async function process(name) {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 100));
  await getMessage(`process ${name}`);
}

async function getMessage(message) {
  return `message is ${message}`;
}

async function task(name) {
  process(name).then(console.log);
}

task("a task");

function report() {
  return "reporting";
}

// held back while process() is pending, unless the async tracking timeout runs out
globalThis.setTimeout(() => report(), 50);
