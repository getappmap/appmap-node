import { parse } from "meriyah";
import * as instrument from "../instrument";
import * as registry from "../../registry";

describe(instrument.shouldInstrument, () => {
  instrument.setRoot("/test");
  test.each([
    ["node:test", false],
    ["file:///test/test.json", false],
    ["file:///var/test.js", false],
    ["file:///test/test.js", true],
    ["file:///test/node_modules/test.js", false],
  ])("%s", (url, expected) => expect(instrument.shouldInstrument(new URL(url))).toBe(expected));
});

describe(instrument.transform, () => {
  it("instruments function declarations", () => {
    const program = parse(`
      function testFun(arg) {
        return arg + 1;
      }
    `);
    expect(instrument.transform(program)).toStrictEqual(
      parse(`
        function testFun(arg) {
          return global.AppMap[0].call(this, function testFun(arg) {
            return arg + 1;
          }, arguments, 0);
        }
      `),
    );
    expect(registry.functions[0]).toStrictEqual<registry.FunctionInfo>({
      params: [{ type: "Identifier", name: "arg" }],
      id: "testFun",
      async: false,
      generator: false,
      location: undefined,
      static: true,
    });
  });

  it("instruments method definitions", () => {
    const program = parse(`
      class TestClass {
        foo(value) {
          return value + 1;
        }
      }
    `);
    expect(instrument.transform(program)).toStrictEqual(
      parse(`
        class TestClass {
          foo(value) {
            return global.AppMap[0].call(this, function (value) {
              return value + 1;
            }, arguments, 0);
          }
        }
      `),
    );
    expect(registry.functions[0]).toStrictEqual<registry.FunctionInfo>({
      params: [{ type: "Identifier", name: "value" }],
      id: "foo",
      klass: "TestClass",
      static: false,
      async: false,
      generator: false,
      location: undefined,
    });
  });
});

beforeEach(() => registry.functions.splice(0));
