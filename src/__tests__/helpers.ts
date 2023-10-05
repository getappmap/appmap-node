import { identifier } from "../generate";
import { addFunction } from "../registry";

export function addTestFn(name: string, ...args: string[]): number {
  return addFunction({
    async: false,
    generator: false,
    id: identifier(name),
    params: args.map(identifier),
    type: "FunctionDeclaration",
  });
}
