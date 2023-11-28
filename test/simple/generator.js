function* f1() {
  console.log("f1");
  yield 0;
  yield 1;
  yield 2;
}

f1().next();

class A {
  *m2() {
    console.log("A.m2");
    yield "A.m2";
  }
}

class B extends A {
  *m1() {
    console.log("C.m1");
    yield "x";
    yield "y";
    yield "z";
  }

  *m2() {
    super.m2();
    yield "B.m2";
  }
}
new B().m1().next();
