import { Chalk } from "chalk";

function foo(msg) {
  console.log(new Chalk().red(msg));
}

function bar(msg) {
  console.log(msg);
}

foo("hello");
bar("world");
