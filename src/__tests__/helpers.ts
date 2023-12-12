import { identifier } from "../generate";
import { FunctionInfo, createFunctionInfo } from "../registry";

export function createTestFn(name: string, ...args: string[]): FunctionInfo {
  return createFunctionInfo(
    {
      async: false,
      generator: false,
      id: identifier(name),
      params: args.map(identifier),
      type: "FunctionDeclaration",
    },
    { path: "test.js", lineno: 42 },
  );
}
