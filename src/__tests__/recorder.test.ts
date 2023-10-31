/* eslint-disable @typescript-eslint/unbound-method */
import AppMap from "../AppMap";
import { createTestFn } from "./helpers";
import * as recorder from "../recorder";
import Recording from "../Recording";

describe(recorder.record, () => {
  it("records the function call", () => {
    const fn = jest.fn().mockImplementation(function (this: string, arg1, arg2) {
      expect(this).toBe("this");
      expect(arg1).toBe("arg1");
      expect(arg2).toBe("arg2");
      jest.advanceTimersByTime(31337);
      return "return";
    });
    const testFn = createTestFn("testFun", "param0", "param1");
    const result = recorder.record.call("this", fn, ["arg1", "arg2"], testFn);
    expect(result).toBe("return");
    expect(fn).toBeCalled();
    expect(Recording.prototype.functionCall).lastCalledWith(testFn, "this", ["arg1", "arg2"]);
    expect(Recording.prototype.functionReturn).lastCalledWith(1, "return", expect.closeTo(31.337));
  });

  it("treats functions called with global this as static", () => {
    const fn = jest.fn(function () {
      expect(this).toBe(globalThis);
    });
    recorder.record.call(global, fn, [], createTestFn("getThis"));
    const [[call]] = jest.mocked(Recording.prototype.functionCall).mock.calls;
    expect(call).not.toHaveProperty("this_");
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

jest.mock("../Recording");

let id = 1;
jest
  .mocked(Recording)
  .prototype.functionCall.mockImplementation(() => ({ id: id++ }) as AppMap.FunctionCallEvent);
Object.defineProperty(Recording.prototype, "running", { get: () => true });

jest.useFakeTimers();
