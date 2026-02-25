import { generate } from "astring";
import { parse } from "meriyah";

import { jsxGenerator } from "../jsxGenerate";

function roundtrip(jsx: string): string {
  const ast = parse(jsx, { next: true, module: true, jsx: true, loc: true });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  return generate(ast as any, { generator: jsxGenerator });
}

describe("JSX code generation", () => {
  describe("elements", () => {
    it("generates a self-closing element", () => {
      expect(roundtrip("<br/>")).toContain("<br/>");
    });

    it("generates an element with text content", () => {
      expect(roundtrip("<div>hello</div>")).toContain("<div>hello</div>");
    });

    it("generates an element with a child element", () => {
      expect(roundtrip("<div><span/></div>")).toContain("<div><span/></div>");
    });

    it("generates nested elements", () => {
      expect(roundtrip("<ul><li>a</li><li>b</li></ul>")).toContain("<ul><li>a</li><li>b</li></ul>");
    });
  });

  describe("attributes", () => {
    it("generates a string attribute", () => {
      expect(roundtrip('<div id="foo"/>')).toContain('id="foo"');
    });

    it("generates a boolean (valueless) attribute", () => {
      expect(roundtrip("<input disabled/>")).toContain("disabled");
    });

    it("generates an expression attribute", () => {
      expect(roundtrip("<div className={styles.foo}/>")).toContain("className={styles.foo}");
    });

    it("generates a spread attribute", () => {
      expect(roundtrip("<div {...rest}/>")).toContain("{...rest}");
    });

    it("generates multiple attributes", () => {
      const out = roundtrip('<a href="/foo" target="_blank"/>');
      expect(out).toContain('href="/foo"');
      expect(out).toContain('target="_blank"');
    });
  });

  describe("expressions in children", () => {
    it("generates an expression container", () => {
      expect(roundtrip("<div>{x}</div>")).toContain("{x}");
    });

    it("generates a complex expression", () => {
      expect(roundtrip("<div>{a + b}</div>")).toContain("{a + b}");
    });

    it("generates mixed text and expressions", () => {
      const out = roundtrip("<div>hello {name}!</div>");
      expect(out).toContain("hello ");
      expect(out).toContain("{name}");
    });
  });

  describe("component names", () => {
    it("generates a component identifier", () => {
      expect(roundtrip("<MyComponent/>")).toContain("<MyComponent/>");
    });

    it("generates a member expression component", () => {
      expect(roundtrip("<Foo.Bar/>")).toContain("<Foo.Bar/>");
    });

    it("generates a namespaced element", () => {
      expect(roundtrip("<svg:circle/>")).toContain("<svg:circle/>");
    });
  });

  describe("fragments", () => {
    it("generates an empty fragment", () => {
      expect(roundtrip("<></>")).toContain("<></>");
    });

    it("generates a fragment with children", () => {
      const out = roundtrip("<>hello <br/></>");
      expect(out).toContain("<>");
      expect(out).toContain("</>");
      expect(out).toContain("<br/>");
    });
  });

  describe("integration: instrumented JSX function", () => {
    it("roundtrips a JSX-returning function after parse/generate", () => {
      const src = `export default function About() { return <div>About</div>; }`;
      const out = roundtrip(src);
      expect(out).toContain("function About");
      expect(out).toContain("<div>About</div>");
    });
  });
});
