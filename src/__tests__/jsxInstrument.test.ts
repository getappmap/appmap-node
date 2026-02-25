import { parse } from "meriyah";
import * as instrument from "../hooks/instrument";

// Use a path inside the project root so appmap.yml's `path: .` matches it.
const testUrl = new URL("file://" + process.cwd() + "/src/test.jsx");

function transformJsx(source: string) {
  const ast = parse(source, {
    source: testUrl.toString(),
    next: true,
    jsx: true,
    loc: true,
    module: true,
  });
  return instrument.transform(ast);
}

function isInstrumented(program: ReturnType<typeof transformJsx>): boolean {
  return program.body.some(
    (n) =>
      n.type === "VariableDeclaration" &&
      n.declarations?.[0]?.id?.name === "__appmapFunctionRegistry",
  );
}

describe("JSX instrumentation (acorn-walk + JSX nodes)", () => {
  it("instruments a named function that returns a JSX element", () => {
    const result = transformJsx(`export default function About() { return <div>About</div>; }`);
    expect(isInstrumented(result)).toBe(true);
  });

  it("instruments a named function that returns a JSX fragment", () => {
    const result = transformJsx(`export default function App() { return <><div/><span/></>; }`);
    expect(isInstrumented(result)).toBe(true);
  });

  it("instruments a named function with JSX attributes and expressions", () => {
    const result = transformJsx(
      `export default function App({ name }) { return <div className="foo">{name}</div>; }`,
    );
    expect(isInstrumented(result)).toBe(true);
  });

  it("instruments a named function with nested JSX", () => {
    const result = transformJsx(
      `export default function List() { return <ul><li>a</li><li>b</li></ul>; }`,
    );
    expect(isInstrumented(result)).toBe(true);
  });

  it("instruments a const arrow function that returns JSX", () => {
    const result = transformJsx(`export const Button = () => <button>Click me</button>;`);
    expect(isInstrumented(result)).toBe(true);
  });

  it("instruments a function with a JSX spread attribute", () => {
    const result = transformJsx(
      `export default function Btn(props) { return <button {...props}>ok</button>; }`,
    );
    expect(isInstrumented(result)).toBe(true);
  });

  it("instruments a function with a JSX member-expression component", () => {
    const result = transformJsx(`export default function Page() { return <Foo.Bar baz="1"/>; }`);
    expect(isInstrumented(result)).toBe(true);
  });
});
