import { identifier } from "../generate";
import * as registry from "../registry";

describe(registry.addFunction, () => {
  it("adds a function to registry and returns an index", () => {
    const index = registry.addFunction({
      async: false,
      generator: false,
      id: identifier("testFun"),
      params: [],
      type: "FunctionDeclaration",
    });

    expect(registry.functions[index]).toStrictEqual<registry.FunctionInfo>({
      async: false,
      generator: false,
      id: "testFun",
      params: [],
      location: undefined,
      static: true,
    });
  });
});

describe(registry.addMethod, () => {
  it("adds a method to registry and returns an index", () => {
    const index = registry.addMethod(
      {
        computed: false,
        key: identifier("testMethod"),
        kind: "method",
        static: false,
        type: "MethodDefinition",
        value: {
          async: false,
          generator: false,
          id: null,
          params: [],
          type: "FunctionExpression",
        },
      },
      {
        body: { body: [], type: "ClassBody" },
        id: identifier("TestClass"),
        superClass: null,
        type: "ClassDeclaration",
      },
    );

    expect(registry.functions[index]).toStrictEqual<registry.FunctionInfo>({
      async: false,
      generator: false,
      params: [],
      id: "testMethod",
      klass: "TestClass",
      location: undefined,
      static: false,
    });
  });
});
