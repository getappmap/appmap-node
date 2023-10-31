import { identifier } from "../generate";
import * as registry from "../registry";

describe(registry.createFunctionInfo, () => {
  it("creates a function info", () => {
    const functionInfo = registry.createFunctionInfo({
      async: false,
      generator: false,
      id: identifier("testFun"),
      params: [],
      type: "FunctionDeclaration",
    });

    expect(functionInfo).toStrictEqual<registry.FunctionInfo>({
      async: false,
      generator: false,
      id: "testFun",
      params: [],
      location: undefined,
      static: true,
    });
  });
});

describe(registry.createMethodInfo, () => {
  it("creates a method info", () => {
    const methodInfo = registry.createMethodInfo(
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

    expect(methodInfo).toStrictEqual<registry.FunctionInfo>({
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
