import { full as walk } from "acorn-walk";
import { ESTree, parse } from "meriyah";

import config from "../../config";
import { fixAbsPath } from "./fixAbsPath";
import * as instrument from "../instrument";
import PackageMatcher from "../../PackageMatcher";
import * as registry from "../../registry";

describe(instrument.shouldInstrument, () => {
  jest.replaceProperty(config, "root", fixAbsPath("/test"));
  jest.replaceProperty(
    config,
    "packages",
    new PackageMatcher(fixAbsPath("/test"), [{ path: ".", exclude: ["node_modules"] }]),
  );

  test.each([
    ["node:test", false],
    [fixAbsPath("file:///test/test.json"), false],
    [fixAbsPath("file:///var/test.js"), false],
    [fixAbsPath("file:///test/test.js"), true],
    [fixAbsPath("file:///test/node_modules/test.js"), false],
  ])("%s", (url, expected) => expect(instrument.shouldInstrument(new URL(url))).toBe(expected));
});

describe(instrument.transform, () => {
  it("instruments function declarations", () => {
    const program = parse(
      `
      function testFun(arg) {
        return arg + 1;
      }
    `,
      { loc: true, source: "test.js" },
    );
    expect(stripLocations(instrument.transform(program))).toStrictEqual(
      parse(`
        const __appmapFunctionRegistry = [{
          "async": false,
          "generator": false,
          "id": "testFun",
          "params": [{
            "type": "Identifier",
            "name": "arg"
          }],
          "location": {
            "path": "test.js",
            "lineno": 2
          },
          "klassOrFile": "test",
          "static": true
        }];

        function testFun(arg) {
          return global.AppMapRecordHook.call(this, arg => {
            return arg + 1;
          }, arguments, __appmapFunctionRegistry[0]);
        }
      `),
    );
    expect(instrument.transformedFunctionInfos[0]).toStrictEqual<registry.FunctionInfo>({
      params: [{ type: "Identifier", name: "arg" }],
      id: "testFun",
      async: false,
      generator: false,
      location: { path: "test.js", lineno: 2 },
      static: true,
      klassOrFile: "test",
    });
  });

  it("instruments method definitions", () => {
    const program = parse(
      `
      class TestClass {
        foo(value) {
          return value + 1;
        }
      }
    `,
      { loc: true, source: "test.js" },
    );

    expect(stripLocations(instrument.transform(program))).toStrictEqual(
      parse(`
        const __appmapFunctionRegistry = [{
          "async": false,
          "generator": false,
          "id": "foo",
          "params": [{
            "type": "Identifier",
            "name": "value"
          }],
          "static": false,
          "klassOrFile": "TestClass",
          "location": {
            "path": "test.js",
            "lineno": 3
          }
        }];

        class TestClass {
          foo(value) {
            return global.AppMapRecordHook.call(this, value => {
              return value + 1;
            }, arguments, __appmapFunctionRegistry[0]);
          }
        }
      `),
    );
    expect(instrument.transformedFunctionInfos[0]).toStrictEqual<registry.FunctionInfo>({
      params: [{ type: "Identifier", name: "value" }],
      id: "foo",
      klassOrFile: "TestClass",
      static: false,
      async: false,
      generator: false,
      location: {
        path: "test.js",
        lineno: 3,
      },
    });
  });
});

beforeEach(() => instrument.transformedFunctionInfos.splice(0));

// Return the program with all location information stripped
function stripLocations(program: ESTree.Program): ESTree.Program {
  walk(program, (node: ESTree.Node) => {
    node.loc && delete node.loc;
    "key" in node && node.key && "loc" in node.key && delete node.key.loc;
  });
  return program;
}

jest.mock("../../config");
