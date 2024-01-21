import { twice } from "./subproject/util.mjs";

export function helloWorld() {
  console.log(`Hello World from mjs: ${twice(21)}`);
}

helloWorld();
