import { parse } from "meriyah";

import { fixAbsPath } from "./fixAbsPath";
import * as jestHook from "../jest";
import transform from "../../transform";

describe(jestHook.shouldInstrument, () => {
  it("instruments jest Runtime", () => {
    expect(
      jestHook.shouldInstrument(new URL("file:///test/node_modules/jest-runtime/build/index.js")),
    ).toBe(true);
    expect(
      jestHook.shouldInstrument(
        new URL("file:///test/node_modules/@jest/transform/build/NotScriptTransformer.js"),
      ),
    ).toBe(false);
  });
});

describe(jestHook.patchRuntime, () => {
  it("transforms the transformFile results", () => {
    const program = parse(`
      class Runtime {
        transformFile() {
          if (false) return 4;
          return 5;
        }

        otherMethod() {}
      }`);

    const xformed = jestHook.patchRuntime(program);

    expect(xformed).toEqual(
      parse(`
        class Runtime {
          transformFile() {
            return global.AppMap[0].call(
              this,
              () => {
                if (false) return 4;
                return 5;
              },
              arguments,
            );
          }

          otherMethod() {}
        }
      `),
    );
  });
});

describe(jestHook.transformJest, () => {
  it("pushes jest transformed code through appmap hooks", () => {
    jest.mocked(transform).mockReturnValue("transformed test code");
    const result = jestHook.transformJest.call(undefined, () => "test code", [
      fixAbsPath("/test/test.js"),
    ]);
    expect(result).toBe("transformed test code");
    expect(transform).toBeCalledWith("test code", new URL(fixAbsPath("file:///test/test.js")));
  });
});

jest.mock("../../transform");
