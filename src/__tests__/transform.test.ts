import { ESTree } from "meriyah";
import transform, { Hook } from "../transform";
import { literal } from "../generate";
import { warn } from "../message";

describe(transform, () => {
  it("uses hooks to transform the code", () => {
    const testHooks: Hook[] = [new TestHook(/foo/), new TestHook(/bar/)];
    const transforms = testHooks.map((t) => jest.spyOn(t, "transform"));

    expect(transform("'hello'", new URL("file:///foo"), testHooks)).toBe('"hello";\n"/foo/";\n');
    expect(transforms[0]).toBeCalled();
    expect(transforms[1]).not.toBeCalled();
    transforms[0].mockReset();

    expect(transform("'hello'", new URL("file:///bar"), testHooks)).toBe('"hello";\n"/bar/";\n');
    expect(transforms[0]).not.toBeCalled();
    expect(transforms[1]).toBeCalled();
    transforms[1].mockReset();

    expect(transform("'hello'", new URL("file:///other"), testHooks)).toBe("'hello'");
    expect(transforms[0]).not.toBeCalled();
    expect(transforms[1]).not.toBeCalled();
  });

  it("returns original code on error", () => {
    expect(
      transform("'hello'", new URL("file:///foo"), [
        {
          shouldInstrument() {
            return true;
          },
          transform() {
            throw new Error("test error");
          },
        },
      ]),
    ).toBe("'hello'");

    expect(jest.mocked(warn).mock.calls).toMatchSnapshot();
  });
});

class TestHook implements Hook {
  constructor(public pattern: RegExp) {}

  shouldInstrument(url: URL): boolean {
    return this.pattern.test(url.toString());
  }

  transform(program: ESTree.Program): ESTree.Program {
    return {
      ...program,
      body: [
        ...program.body,
        {
          type: "ExpressionStatement",
          expression: literal(this.pattern.toString()),
        },
      ],
    };
  }
}

jest.mock("../message");
