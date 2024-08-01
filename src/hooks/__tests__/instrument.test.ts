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

  it("instruments const lambdas", () => {
    const program = parse(
      `
      const outer = arg => arg + 42;

      export const testFun = arg => {
        var s42 = y => y - 42;
        let s43 = y => y - 43;
        const inner = x => s42(x) * 2;
        return inner(arg);
      };
    `,
      { loc: true, source: fixAbsPath("/test/test.js"), module: true },
    );

    expectProgram(
      instrument.transform(program),
      `
      const __appmapFunctionRegistry = [
        {
          "async": false,
          "generator": false,
          "id": "outer",
          "params": [
            {
              "type": "Identifier",
              "name": "arg",
            },
          ],
          "location": {
            "path": "test.js",
            "lineno": 2,
          },
          "klassOrFile": "test",
          "static": true,
        },
        {
          "async": false,
          "generator": false,
          "id": "inner",
          "params": [
            {
              "type": "Identifier",
              "name": "x",
            },
          ],
          "location": {
            "path": "test.js",
            "lineno": 7,
          },
          "klassOrFile": "test",
          "static": true,
        },
        {
          "async": false,
          "generator": false,
          "id": "testFun",
          "params": [
            {
              "type": "Identifier",
              "name": "arg",
            },
          ],
          "location": {
            "path": "test.js",
            "lineno": 4,
          },
          "klassOrFile": "test",
          "static": true,
        },
      ];

      const outer = (...$appmap$args) => global.AppMapRecordHook.call(
        undefined,
        (arg) => arg + 42,
        $appmap$args,
        __appmapFunctionRegistry[0],
      );

      export const testFun = (...$appmap$args) =>
        global.AppMapRecordHook.call(
          undefined,
          (arg) => {
            var s42 = y => y - 42;
            let s43 = y => y - 43;
            const inner = (...$appmap$args) =>
              global.AppMapRecordHook.call(
                undefined,
                (x) => s42(x) * 2,
                $appmap$args,
                __appmapFunctionRegistry[1],
              );
            return inner(arg);
          },
          $appmap$args,
          __appmapFunctionRegistry[2],
        );
    `,
    );
  });

  it("instruments CommonJS exported named lambdas", () => {
    const program = parse(
      `
      exports.testFun = arg => {
        const inner = x => x *2;
        return inner(arg);
      };
    `,
      { loc: true, source: fixAbsPath("/test/test.js"), module: true },
    );

    expectProgram(
      instrument.transform(program),
      `
      const __appmapFunctionRegistry = [
        {
          "async": false,
          "generator": false,
          "id": "inner",
          "params": [
            {
              "type": "Identifier",
              "name": "x",
            },
          ],
          "location": {
            "path": "test.js",
            "lineno": 3,
          },
          "klassOrFile": "test",
          "static": true,
        },
        {
          "async": false,
          "generator": false,
          "id": "testFun",
          "params": [
            {
              "type": "Identifier",
              "name": "arg",
            },
          ],
          "location": {
            "path": "test.js",
            "lineno": 2,
          },
          "klassOrFile": "test",
          "static": true,
        },
      ];

      exports.testFun = (...$appmap$args) =>
        global.AppMapRecordHook.call(
          undefined,
          (arg) => {
            const inner = (...$appmap$args) =>
              global.AppMapRecordHook.call(
                undefined,
                (x) => x * 2,
                $appmap$args,
                __appmapFunctionRegistry[0],
              );
            return inner(arg);
          },
          $appmap$args,
          __appmapFunctionRegistry[1],
        );
    `,
    );
  });

  it("instruments const lambdas which are later CommonJS exported", () => {
    const program = parse(
      `
      const testFun = x => x * 2

      exports.testFun = testFun;
    `,
      { loc: true, source: fixAbsPath("/test/test.js"), module: true },
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
            "name": "x"
          }],
          "location": {
            "path": "test.js",
            "lineno": 2
          },
          "klassOrFile": "test",
          "static": true
        }];

        const testFun = (...$appmap$args) => global.AppMapRecordHook.call(undefined, x => x * 2,
          $appmap$args, __appmapFunctionRegistry[0]);

        exports.testFun = testFun;
      `,
    );
  });
});

function expectProgram(actual: ESTree.Program, expected: string) {
  expect(generate(actual)).toEqual(generate(parse(expected, { module: true })));
}

jest.mock("../../config");
