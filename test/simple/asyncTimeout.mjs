import { setTimeout } from "timers/promises";

async function process(name) {
  await setTimeout(100);
  await getMessage(`process ${name}`);
}

async function getMessage(message) {
  return `message is ${message}`;
}

async function task(name) {
  process(name).then(console.log);
}

task("a task");
