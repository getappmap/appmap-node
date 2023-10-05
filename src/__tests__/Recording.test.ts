/* eslint-disable @typescript-eslint/unbound-method */
import AppMapStream from "../AppMapStream";
import Recording from "../Recording";
import { makeReturnEvent } from "../event";
import { functions } from "../registry";
import { addTestFn } from "./helpers";

describe(Recording.prototype.fixup, () => {
  it("adds an event update to the stream", () => {
    const recording = new Recording("process", "test", "test");
    const funIdx = addTestFn("testFun");
    const call = recording.functionCall(functions[funIdx], undefined, []);
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
