import assert from "node:assert";
import AppMap from "../AppMap";
import { makeClassMap } from "../classMap";
import config from "../config";
import { FunctionInfo, SourceLocation } from "../registry";

describe(makeClassMap, () => {
  it("creates a classmap from functions", () => {
    const functions: FunctionInfo[] = [
      f("method", "/test/app/src/util.js:17", "Util", false),
      f("otherFunction", "/test/app/src/util.js:3", "util"),
      f("foo", "/test/app/src/foo.js:3", "foo"),
      f("freeFunction", "/test/app/src/util.js:1", "util"),
      f("otherFunction", "/test/app/src/util/other.js:1", "other"),
      f("statik", "/test/app/src/util.js:14", "Util"),
    ];

    check(functions, {
      src: {
        util: {
          c_other: ["otherFunction@/test/app/src/util/other.js:1"],
        },
        c_Util: ["m:method@/test/app/src/util.js:17", "statik@/test/app/src/util.js:14"],
        c_util: ["freeFunction@/test/app/src/util.js:1", "otherFunction@/test/app/src/util.js:3"],
        c_foo: ["foo@/test/app/src/foo.js:3"],
      },
    });
  });

  it("handles dots in paths correctly", () => {
    check(
      [
        f("fun", "/test/app.map/src/util.js:42", "util"),
        f("fun", "/test/app.map/src/other.js:42", "other"),
      ],
      {
        src: {
          c_util: ["fun@/test/app.map/src/util.js:42"],
          c_other: ["fun@/test/app.map/src/other.js:42"],
        },
      },
    );
  });

  it("uses the app name as the top level package if required", () => {
    jest.replaceProperty(config, "appName", "testApp");
    // if a path is just a file, the class would have been
    // toplevel which is prohibited by the spec
    check([f("fun", "util.js:42", "util"), f("other", "src/other.js:42", "other")], {
      testApp: {
        c_util: ["fun@util.js:42"],
        src: {
          c_other: ["other@src/other.js:42"],
        },
      },
    });
  });
});

function check(funs: FunctionInfo[], expected: ClassMapTemplate) {
  expect(concise(makeClassMap(funs))).toStrictEqual(expected);
}

type ClassMapTemplate = PkgTemplate | string[];
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface PkgTemplate extends Record<string, ClassMapTemplate> {}

function concise(map: (AppMap.Package | AppMap.Class | AppMap.FunctionInfo)[]): PkgTemplate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  const fname = (entry: any) => (entry.static ? "" : "m:") + entry.name + "@" + entry.location;

  return Object.fromEntries(
    map.map((entry) => {
      assert(entry.type !== "function");
      if (entry.type === "class")
        return ["c_" + entry.name, expect.arrayContaining(entry.children!.map(fname))];
      else return [entry.name, concise(entry.children!)];
    }),
  ) as PkgTemplate;
}

function f(
  id: string,
  loc: string,
  klass: string,
  static_ = true,
  async = false,
  generator = false,
): FunctionInfo {
  let location: SourceLocation | undefined;
  if (loc) {
    const [path, lineno] = loc.split(":");
    location = { path, lineno: Number(lineno) };
  }
  return {
    async,
    generator,
    id,
    params: [],
    static: static_,
    klassOrFile: klass,
    location,
  };
}
