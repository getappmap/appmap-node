import { ESTree } from "meriyah";

import type AppMap from "./AppMap";
import { optParameter, parameter, type Parameter } from "./parameter";
import type { Event as RecorderEvent } from "./recorder";
import { FunctionInfo } from "./registry";
import compactObject from "./util/compactObject";

export function toAppMap(event: RecorderEvent): AppMap.Event {
  const result = event.type === "call" ? makeCallEvent(event) : makeReturnEvent(event);
  return compactObject(result);
}

function makeCallEvent(event: RecorderEvent & { type: "call" }): AppMap.CallEvent {
  const { this_, id, fun, args } = event;
  return {
    event: "call",
    id,
    thread_id: 0,
    method_id: fun.id,
    static: !this_,
    receiver: optParameter(this_),
    parameters: resolveParameters(args, fun),
    defined_class: fun.klass ?? "",
    ...fun.location,
  };
}

function makeReturnEvent(event: RecorderEvent & { type: "return" }): AppMap.ReturnEvent {
  return {
    event: "return",
    thread_id: 0,
    id: event.id,
    parent_id: event.parent_id,
    return_value: optParameter(event.return_value),
  };
}

function resolveParameters(args: unknown[], fun: FunctionInfo): Parameter[] {
  return args.map(
    (value, index): Parameter => ({
      ...parameter(value),
      name: paramName(fun.params[index]),
    }),
  );
}

function paramName(param: ESTree.Parameter): string | undefined {
  switch (param.type) {
    case "Identifier":
      return param.name;
    case "AssignmentPattern":
      return paramName(param.left);
    // TODO: handle other parameter types
  }
}
