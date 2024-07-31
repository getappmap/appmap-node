import importedJson from "./importAttributes.json" assert { type: "json" };

export function helloWorld() {
  console.log(importedJson);
}

helloWorld();
