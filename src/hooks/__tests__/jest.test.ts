import console from "node:console";

import { parse } from "meriyah";
import * as jestHook from "../jest";
import transform from "../../transform";

describe(jestHook.shouldInstrument, () => {
  it("instruments ScriptTransformer", () => {
    expect(
      jestHook.shouldInstrument(
        new URL(
          "file:///test/node_modules/@jest/transform/build/ScriptTransformer.js",
        ),
      ),
    ).toBe(true);
    expect(
      jestHook.shouldInstrument(
        new URL(
          "file:///test/node_modules/@jest/transform/build/NotScriptTransformer.js",
        ),
      ),
    ).toBe(false);
  });
});

describe(jestHook.transform, () => {
  it("transforms the transformSource results", () => {
    const program = parse(`
      class ScriptTransformer {
        transformSource() {
          if (false) return 4;
          return 5;
        }

        otherMethod() {}
      }`);

    const xformed = jestHook.transform(program);

    expect(xformed).toEqual(
      parse(`
        class ScriptTransformer {
          transformSource() {
            if (false) return global.AppMap.transformJest(filename, 4);
            return global.AppMap.transformJest(filename, 5);
          }

          otherMethod() {}
        }`),
    );
  });

  it("generates a warning if code has unexpected structure", () => {
    const program = parse(`
      class ScriptTransformer {
        transformSource() { return; }
      }`);

    const warnSpy = (console.warn = jest.fn());

    expect(jestHook.transform(program)).toStrictEqual(program);
    expect(warnSpy.mock.lastCall).toMatchSnapshot();
  });
});

describe(jestHook.transformJest, () => {
  it("pushes jest transformed code through appmap hooks", () => {
    jest.mocked(transform).mockReturnValue("transformed test code");
    const result = jestHook.transformJest("/test/test.js", {
      code: "test code",
      originalCode: "original test code",
      sourceMapPath: null,
    });
    expect(result).toStrictEqual({
      code: "transformed test code",
      originalCode: "original test code",
      sourceMapPath: null,
    });
    expect(transform).toBeCalledWith(
      "test code",
      new URL("file:///test/test.js"),
    );
  });
});

jest.mock("../../transform");
