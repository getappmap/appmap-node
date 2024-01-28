import { setTimeout } from "timers/promises";

async function process(name) {
  const message = await getMessage(`process ${name}`);
  return processMessage(message);
}

async function getMessage(message) {
  await setTimeout(100);
  return `message is ${message}`;
}

async function processMessage(message) {
  await setTimeout(100);
  return `processed message ${message}`;
}

async function task(name) {
  process(name).then(console.log);
  await setTimeout(50);
  return getMessage(`${name} toplevel`).then(console.log);
}

task("first");
await setTimeout(25);
task("second");
