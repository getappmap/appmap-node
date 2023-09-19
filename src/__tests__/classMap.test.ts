import AppMap from "../AppMap";
import { makeClassMap } from "../classMap";
import { FunctionInfo, SourceLocation } from "../registry";

describe(makeClassMap, () => {
  it("creates a classmap from functions", () => {
    const functions: FunctionInfo[] = [
      f("method", "/test/app/src/util.js:17", "Util", false),
      f("otherFunction", "/test/app/src/util.js:3"),
      f("foo", "/test/app/src/foo.js:3"),
      f("noLocation"),
      f("freeFunction", "/test/app/src/util.js:1"),
      f("otherFunction", "/test/app/src/util/other.js:1"),
      f("statik", "/test/app/src/util.js:14", "Util"),
    ];

    expect(makeClassMap(functions)).toStrictEqual<AppMap.ClassMap>([
      {
        type: "package",
        name: "foo",
        children: [
          {
            type: "class",
            name: "",
            children: [
              { type: "function", name: "foo", static: true, location: "/test/app/src/foo.js:3" },
            ],
          },
        ],
      },
      {
        type: "package",
        name: "util",
        children: [
          {
            type: "package",
            name: "other",
            children: [
              {
                type: "class",
                name: "",
                children: [
                  {
                    type: "function",
                    name: "otherFunction",
                    static: true,
                    location: "/test/app/src/util/other.js:1",
                  },
                ],
              },
            ],
          },
          {
            type: "class",
            name: "",
            children: [
              {
                type: "function",
                name: "freeFunction",
                static: true,
                location: "/test/app/src/util.js:1",
              },
              {
                type: "function",
                name: "otherFunction",
                static: true,
                location: "/test/app/src/util.js:3",
              },
            ],
          },
          {
            type: "class",
            name: "Util",
            children: [
              {
                type: "function",
                name: "statik",
                static: true,
                location: "/test/app/src/util.js:14",
              },
              {
                type: "function",
                name: "method",
                static: false,
                location: "/test/app/src/util.js:17",
              },
            ],
          },
        ],
      },
    ]);
  });
});

function f(
  id: string,
  loc?: string,
  klass?: string,
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
    klass,
    location,
  };
}
