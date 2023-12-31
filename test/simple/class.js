class A {
  constructor() {
    console.log("A.constructor()");
  }

  m1() {
    console.log("A.m1()");
  }
  m2() {
    console.log("A.m2()");
    return "return m2";
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
  }
}

new A();
new B().m1();
