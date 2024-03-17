/* eslint-disable @typescript-eslint/unbound-method */
import { setTimeout } from "node:timers/promises";

import AppMapStream from "../AppMapStream";
import { makeReturnEvent } from "../event";
import { resetObjectIds } from "../parameter";
import { createTestFn } from "./helpers";
import Recording from "../Recording";

describe(Recording.prototype.fixup, () => {
  it("adds an event update to the stream", () => {
    const recording = new Recording("process", "test", "test");
    const funInfo = createTestFn("testFun");
    const call = recording.functionCall(funInfo, undefined, []);
    const ret = recording.functionReturn(call.id, "result", undefined);
    const retEvent = makeReturnEvent(ret.id, call.id, "fixed result", 31.337);
    recording.fixup(retEvent);
    recording.finish();
    expect(AppMapStream.prototype.close).toBeCalledWith(
      expect.objectContaining({
        eventUpdates: {
          [ret.id]: retEvent,
        },
      }),
    );
  });

  describe(Recording.prototype.functionReturn, () => {
    it("records a fix up after the promise resolves", async () => {
      const recording = new Recording("process", "test", "test");
      const fixup = jest.spyOn(recording, "fixup");
      const funInfo = createTestFn("testFun");
      const call = recording.functionCall(funInfo, undefined, []);
      const result = setTimeout(10, "resolved");
      const ret = recording.functionReturn(call.id, result, undefined);
      await expect(result).resolves.toBe("resolved");

      expect(fixup).toBeCalledTimes(1);
      expect(fixup).toBeCalledWith({
        ...ret,
        return_value: {
          class: "Promise<String>",
          value: "Promise { 'resolved' }",
          object_id: 1,
        },
        elapsed: undefined,
      });
    });

    it("records a fix up after the promise rejects", async () => {
      const recording = new Recording("process", "test", "test");
      const fixup = jest.spyOn(recording, "fixup");
      const funInfo = createTestFn("testFun");
      const call = recording.functionCall(funInfo, undefined, []);
      const result = setTimeout(10).then(() => Promise.reject(new Error("test")));
      const ret = recording.functionReturn(call.id, result, undefined);
      await expect(result).rejects.toThrowError("test");

      expect(fixup).toBeCalledTimes(1);

      // this should have both return_value and exceptions
      expect(fixup).toBeCalledWith({
        ...ret,
        return_value: {
          class: "Promise",
          value: "Promise { <rejected> }",
          object_id: 1,
        },
        exceptions: [
          {
            class: "Error",
            message: "test",
            object_id: 2,
          },
        ],
        elapsed: undefined,
      });
    });
  });
});

afterEach(() => {
  jest.clearAllMocks();
  resetObjectIds();
});

jest.mock("../AppMapStream");
