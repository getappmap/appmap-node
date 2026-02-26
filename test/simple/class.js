const { inspect } = require("util");

class A {
  constructor() {
    this.skippedMethod();
    console.log("A.constructor()");
  }

  m1() {
    console.log("A.m1()");
  }
  m2() {
    console.log("A.m2()");
    return "return m2";
  }

  skippedMethod() {
    console.log("A.skippedMethod()");
  }

  static skipped() {
    console.log("A.skipped()");
  }
}

class B extends A {
  constructor() {
    console.log("B.constructor()");
    super();
  }

  m1() {
    super.m1();
    console.log("B.m1()");
    A.skipped();
  }

  [inspect.custom]() {
    throw "Broken custom inspect implementation";
  }
}

new A();
new B().m1();
