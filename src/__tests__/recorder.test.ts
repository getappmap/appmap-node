import AppMapStream from "../AppMapStream";
import { identifier } from "../generate";
import * as recorder from "../recorder";
import { addFunction, functions } from "../registry";

describe(recorder.record, () => {
  it("records the function call", () => {
    const fn = jest.fn().mockImplementation(function (this: string, arg1, arg2) {
      expect(this).toBe("this");
      expect(arg1).toBe("arg1");
      expect(arg2).toBe("arg2");
      return "return";
    });
    const index = addTestFn("testFun", "param0", "param1");
    const result = recorder.record.call("this", fn, ["arg1", "arg2"], index);
    expect(result).toBe("return");
    expect(fn).toBeCalled();
    expect(emit).nthCalledWith(1, {
      type: "call",
      id: 1,
      fun: functions[index],
      args: ["arg1", "arg2"],
      this_: "this",
    });
    expect(emit).nthCalledWith(2, {
      type: "return",
      id: 2,
      parent_id: 1,
      return_value: "return",
    });
  });

  it("treats functions called with global this as static", () => {
    const fn = jest.fn(function () {
      expect(this).toBe(globalThis);
    });
    recorder.record.call(global, fn, [], addTestFn("getThis"));
    const [[call]] = emit.mock.calls;
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

const emit = jest.spyOn(AppMapStream.prototype, "emitEvent");
jest.mock("../AppMapStream");
