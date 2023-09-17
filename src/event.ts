import { fileURLToPath } from "node:url";

import { ESTree } from "meriyah";

import { optParameter, parameter, type Parameter } from "./parameter";
import type { Event as RecorderEvent } from "./recorder";
import { FunctionInfo } from "./registry";
import compactObject from "./util/compactObject";

interface BaseEvent {
  id: number;
  thread_id: number;
}

export interface CallEvent extends BaseEvent {
  event: "call";
  method_id: string;
  defined_class?: string;
  receiver?: Parameter;
  parameters?: Parameter[];
  static: boolean;
  path?: string;
  lineno?: number;
}

export interface ReturnEvent extends BaseEvent {
  event: "return";
  parent_id: number;
  return_value?: Parameter;
}

export type Event = CallEvent | ReturnEvent;

export function toAppMap(event: RecorderEvent): Event {
  const result = event.type === "call" ? makeCallEvent(event) : makeReturnEvent(event);
  return compactObject(result);
}

function makeCallEvent(event: RecorderEvent & { type: "call" }): CallEvent {
  const { this_, id, fun, args } = event;
  const result: Event = {
    event: "call",
    id,
    thread_id: 0,
    method_id: fun.id ?? "<anonymous>",
    static: !this_,
    receiver: optParameter(this_),
    parameters: resolveParameters(args, fun),
    defined_class: fun.klass,
  };
  if (fun.loc?.source?.startsWith("file://")) {
    // TODO make it relative to the root directory
    result.path = fileURLToPath(fun.loc.source);
    result.lineno = fun.loc.start.line;
  }
  return result;
}

function makeReturnEvent(event: RecorderEvent & { type: "return" }): ReturnEvent {
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
