class A {
  m1() {
    console.log("A.m1()");
  }
  m2() {
    console.log("A.m2()");
    return "return m2";
  }
}

class B extends A {
  m1() {
    super.m1();
    console.log("B.m1()");
  }
}

new B().m1();
