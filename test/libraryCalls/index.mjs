import console from "node:console";
import json5 from "json5";

console.log("Hello World");

// This calls console.log internally, and this internal
// console.log call won't be recorded in shallow mode.
// https://github.com/nodejs/node/blob/57d2e4881c9a7f9ac52d49d19d781dc455b2789d/lib/internal/console/constructor.js#L475
console.count("abc");

console.warn("This is excluded in settings");

const obj = json5.parse("{ a: 123 }");
console.log("obj", obj);
