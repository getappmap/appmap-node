/* eslint-disable @typescript-eslint/unbound-method */
import type * as AppMap from "../AppMap";
import Recording from "../Recording";
import { resetObjectIds } from "../parameter";
import * as recorder from "../recorder";
import { pauseRecorder, resumeRecorder } from "../recorderControl";
import { createTestFn } from "./helpers";

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
    expect(Recording.prototype.functionReturn).lastCalledWith(1, "return", 0);
  });

  it("treats functions called with global this as static", () => {
    const fn = jest.fn(function () {
      expect(this).toBe(globalThis);
    });
    recorder.record.call(global, fn, [], createTestFn("getThis"));
    const [[call]] = jest.mocked(Recording.prototype.functionCall).mock.calls;
    expect(call).not.toHaveProperty("this_");
  });

  it("pauses and resumes recorder", () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const f = () => {};
    const fInfo = createTestFn("testFun", "param0", "param1");

    pauseRecorder();

    recorder.record.call("this", f, ["arg1", "arg2"], fInfo);
    expect(Recording.prototype.functionCall).toBeCalledTimes(0);

    resumeRecorder();

    recorder.record.call("this", f, ["arg1", "arg2"], fInfo);
    expect(Recording.prototype.functionCall).toBeCalledTimes(1);
  });
});

afterEach(() => {
  jest.clearAllMocks();
  resetObjectIds();
});

jest.mock("../Recording");

let id = 1;
jest
  .mocked(Recording)
  .prototype.functionCall.mockImplementation(() => ({ id: id++ }) as AppMap.FunctionCallEvent);
Object.defineProperty(Recording.prototype, "running", { get: () => true });

jest.useFakeTimers();
