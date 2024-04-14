import { identifier } from "../generate";
import * as registry from "../registry";

describe(registry.createFunctionInfo, () => {
  it("creates a function info", () => {
    const functionInfo = registry.createFunctionInfo(
      {
        async: false,
        generator: false,
        id: identifier("testFun"),
        params: [],
      },
      { path: "test.js", lineno: 42 },
    );

    expect(functionInfo).toStrictEqual<registry.FunctionInfo>({
      async: false,
      generator: false,
      id: "testFun",
      params: [],
      location: { path: "test.js", lineno: 42 },
      static: true,
      klassOrFile: "test",
      labels: undefined,
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
      klassOrFile: "TestClass",
      location: undefined,
      static: false,
      labels: undefined,
    });
  });
});
