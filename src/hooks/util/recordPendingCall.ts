import type * as AppMap from "../../AppMap";
import Recording from "../../Recording";
import { isActive } from "../../recorder";
import { getTime } from "../../util/getTime";

// Records a call whose result comes in later, eg. in a callback. The return events
// are emitted right away, so that they close the call whatever gets recorded in the
// meantime, and are held back until they're filled in by returned() or threw().
export default function recordPendingCall(
  recordings: Recording[],
  emitCall: (recording: Recording) => AppMap.CallEvent,
) {
  const done = Recording.hold();
  const returnEvents = recordings.map((r) => r.pendingReturn(emitCall(r).id));
  const startTime = getTime();

  const complete = (fill: (recording: Recording, event: AppMap.FunctionReturnEvent) => void) => {
    recordings.forEach((r, idx) => isActive(r) && fill(r, returnEvents[idx]));
    done();
  };

  return {
    returned: (result?: unknown) =>
      complete((r, event) => r.completeReturn(event, startTime, result)),
    threw: (exception: unknown) =>
      complete((r, event) => r.completeException(event, startTime, exception)),
  };
}
