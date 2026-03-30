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
