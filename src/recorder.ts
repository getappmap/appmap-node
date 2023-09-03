import { emit } from "./appmap.js";
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

let currentId = 1;

export function record(
  functionIdx: number,
  this_: unknown,
  args: IArguments,
  original: (...args: unknown[]) => unknown,
) {
  const funInfo = functions[functionIdx];
  const call: Event = {
    type: "call",
    fun: funInfo,
    args: [...args].map(parameter),
    id: currentId++,
  };

  if (!funInfo.static) call.this_ = optParameter(this_);

  emit(call);

  // TODO handle exceptions
  const result = original.call(this_, ...args);

  emit({
    type: "return",
    parent_id: call.id,
    return_value: optParameter(result),
    id: currentId++,
  });
  return result;
}
