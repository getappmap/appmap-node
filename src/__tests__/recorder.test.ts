/* eslint-disable @typescript-eslint/unbound-method */
import type * as AppMap from "../AppMap";
import Recording from "../Recording";
import { resetObjectIds } from "../parameter";
import * as recorder from "../recorder";
import { pauseRecorder, resumeRecorder } from "../recorderControl";
import { getTime } from "../util/getTime";
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

describe(recorder.fixReturnEventsIfPromiseResult, () => {
  it("records a fix up after the promise resolves", async () => {
    const promise = Promise.resolve("resolved");
    const result = recorder.fixReturnEventsIfPromiseResult(
      recorder.getActiveRecordings().slice(0, 1),
      promise,
      [returnEvent],
      [callEvent],
      getTime(),
    );

    await expect(result).resolves.toBe("resolved");

    expect(Recording.prototype.fixup).toBeCalledTimes(1);
    expect(Recording.prototype.fixup).toBeCalledWith({
      ...returnEvent,
      return_value: {
        class: "Promise<String>",
        value: "Promise { 'resolved' }",
        object_id: 1,
      },
      elapsed: 0,
    });
  });

  it("records a fix up after the promise rejects", async () => {
    const promise = Promise.reject(new Error("test"));
    const result = recorder.fixReturnEventsIfPromiseResult(
      recorder.getActiveRecordings().slice(0, 1),
      promise,
      [returnEvent],
      [callEvent],
      getTime(),
    );
    await expect(result).rejects.toThrowError("test");

    expect(Recording.prototype.fixup).toBeCalledTimes(1);

    // this should have both return_value and exceptions
    expect(Recording.prototype.fixup).toBeCalledWith({
      ...returnEvent,
      return_value: {
        class: "Promise",
        value: "Promise { <rejected> }",
        object_id: 2,
      },
      exceptions: [
        {
          class: "Error",
          message: "test",
          object_id: 1,
        },
      ],
      elapsed: 0,
    });
  });

  const callEvent: AppMap.FunctionCallEvent = {
    event: "call",
    defined_class: "Test",
    id: 42,
    method_id: "test",
    static: true,
    thread_id: 0,
  };
  const returnEvent: AppMap.FunctionReturnEvent = {
    event: "return",
    id: 43,
    parent_id: 42,
    thread_id: 0,
    return_value: {
      class: "Promise",
      value: "Promise { <pending> }",
    },
  };
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
