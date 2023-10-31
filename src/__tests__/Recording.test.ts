/* eslint-disable @typescript-eslint/unbound-method */
import AppMapStream from "../AppMapStream";
import { makeReturnEvent } from "../event";
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
});

jest.mock("../AppMapStream");
