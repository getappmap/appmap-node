import { emit } from "./appmap";
import { Parameter, optParameter, parameter } from "./parameter";
import { FunctionInfo, functions } from "./registry";

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

export function record<This, Return>(
  this: This,
  fun: (this: This, ...args: unknown[]) => Return,
  args: unknown[],
  functionIdx: number,
): Return {
  const funInfo = functions[functionIdx];
  const call: Event = {
    type: "call",
    fun: funInfo,
    args: [...args].map(parameter),
    id: currentId++,
  };

  if (!funInfo.static && this !== globalThis) call.this_ = optParameter(this);

  emit(call);

  // TODO handle exceptions
  const result = fun.apply(this, args);

  emit({
    type: "return",
    parent_id: call.id,
    return_value: optParameter(result),
    id: currentId++,
  });
  return result;
}
