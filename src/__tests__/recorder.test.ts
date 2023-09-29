/* eslint-disable @typescript-eslint/unbound-method */
import AppMap from "../AppMap";
import { identifier } from "../generate";
import * as recorder from "../recorder";
import Recording from "../Recording";
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
    expect(Recording.prototype.functionCall).lastCalledWith(functions[index], "this", [
      "arg1",
      "arg2",
    ]);
    expect(Recording.prototype.functionReturn).lastCalledWith(1, "return");
  });

  it("treats functions called with global this as static", () => {
    const fn = jest.fn(function () {
      expect(this).toBe(globalThis);
    });
    recorder.record.call(global, fn, [], addTestFn("getThis"));
    const [[call]] = jest.mocked(Recording.prototype.functionCall).mock.calls;
    expect(call).not.toHaveProperty("this_");
  });
});

afterEach(() => {
  functions.splice(0);
  jest.clearAllMocks();
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

jest.mock("../Recording");

let id = 1;
jest
  .mocked(Recording)
  .prototype.functionCall.mockImplementation(() => ({ id: id++ }) as AppMap.FunctionCallEvent);
Object.defineProperty(Recording.prototype, "running", { get: () => true });
