import { emit } from "../appmap";
import { identifier } from "../generate";
import { record, Event } from "../recorder";
import { addFunction, functions } from "../registry";

describe(record, () => {
  it("records the function call", () => {
    const fn = jest.fn().mockImplementation(function (this: string, arg1, arg2) {
      expect(this).toBe("this");
      expect(arg1).toBe("arg1");
      expect(arg2).toBe("arg2");
      return "return";
    });
    const index = addTestFn("testFun", "param0", "param1");
    const result = record.call("this", fn, ["arg1", "arg2"], index);
    expect(result).toBe("return");
    expect(fn).toBeCalled();
    expect(emit).nthCalledWith<[Event]>(1, {
      type: "call",
      id: 1,
      fun: functions[index],
      args: [
        {
          class: "String",
          value: "'arg1'",
        },
        {
          class: "String",
          value: "'arg2'",
        },
      ],
      this_: {
        class: "String",
        value: "'this'",
      },
    });
    expect(emit).nthCalledWith<[Event]>(2, {
      type: "return",
      id: 2,
      parent_id: 1,
      return_value: {
        class: "String",
        value: "'return'",
      },
    });
  });

  it("treats functions called with global this as static", () => {
    const fn = jest.fn(function () {
      expect(this).toBe(globalThis);
    });
    record.call(global, fn, [], addTestFn("getThis"));
    const [[call]] = jest.mocked(emit).mock.calls;
    expect(call).not.toHaveProperty("this_");
  });
});

afterEach(() => {
  functions.splice(0);
  jest.resetAllMocks();
});

function addTestFn(name: string, ...args: string[]): number {
  return addFunction({
    async: false,
    generator: false,
    id: identifier(name),
    params: args.map(identifier),
    type: "FunctionDeclaration",
  });
}

jest.mock("../appmap");
