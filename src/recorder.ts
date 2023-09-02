import { Parameter, optParameter, parameter } from "./parameter.js";
import { FunctionInfo, functions } from "./registry.js";

interface CallEvent {
  type: "call";
  fun: FunctionInfo;
  this_?: Parameter;
  args: Parameter[];
}

interface ReturnEvent {
  type: "return";
  parent_id: number;
  return_value?: Parameter;
}

export type Event = { id: number } & (CallEvent | ReturnEvent);

export const trace: Event[] = [];

export function record(
  functionIdx: number,
  this_: unknown,
  args: IArguments,
  original: (...args: unknown[]) => unknown,
) {
  const call: Event = {
    type: "call",
    fun: functions[functionIdx],
    args: [...args].map(parameter),
    id: trace.length,
    this_: optParameter(this_),
  };

  trace.push(call);
  // TODO handle exceptions
  const result = original.call(this_, ...args);
  trace.push({
    type: "return",
    parent_id: call.id,
    return_value: optParameter(result),
    id: trace.length,
  });
  return result;
}