// eslint-disable-next-line @typescript-eslint/no-var-requires
const console = require("node:console");

// @label auth
// Sign In function description
function signIn() {
  console.debug("signIn");
}

// Label below is not applied to signUp because a
// blank line separates it from continuous single
// line comments.
// @label misplaced

// xyz
// @labels auth mail
function signUp() {
  console.debug("signUp");
}

// @label pure
const lambdaWithLabel = () => 42;

class A {
  x = 1;

  // @label pure
  calc(a, b) {
    return a * this.x + b;
  }

  // no label
  setX(x) {
    this.x = x;
  }
}

// abc
function f1() {
  console.log("f1");
}

function f2() {
  console.log("f2");
}

signUp();
signIn();

f1();
f2();

const a = new A();
a.setX(42);
a.calc(2, 3);

lambdaWithLabel();