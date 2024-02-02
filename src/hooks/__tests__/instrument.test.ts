import { generate } from "astring";
import { ESTree, parse } from "meriyah";

import config from "../../config";
import { fixAbsPath } from "./fixAbsPath";
import * as instrument from "../instrument";
import PackageMatcher from "../../PackageMatcher";

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
      { loc: true, source: fixAbsPath("/test/test.js") },
    );
    expectProgram(
      instrument.transform(program),
      `
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
      `,
    );
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
      { loc: true, source: fixAbsPath("/test/test.js") },
    );

    expectProgram(
      instrument.transform(program),
      `
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
      `,
    );
  });
});

function expectProgram(actual: ESTree.Program, expected: string) {
  expect(generate(actual)).toEqual(generate(parse(expected)));
}

jest.mock("../../config");
