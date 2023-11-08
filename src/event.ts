import { ESTree } from "meriyah";

import type AppMap from "./AppMap";
import { optParameter, parameter } from "./parameter";
import type { FunctionInfo } from "./registry";
import compactObject from "./util/compactObject";

export function makeCallEvent(
  id: number,
  fun: FunctionInfo,
  thisArg: unknown,
  args: unknown[],
): AppMap.FunctionCallEvent {
  return compactObject({
    event: "call",
    id,
    thread_id: 0,
    method_id: fun.id,
    static: !thisArg,
    receiver: optParameter(thisArg),
    parameters: resolveParameters(args, fun),
    defined_class: fun.klass ?? "",
    ...fun.location,
  });
}

export function makeReturnEvent(
  id: number,
  parentId: number,
  result: unknown,
  elapsed?: number,
): AppMap.FunctionReturnEvent {
  return {
    event: "return",
    thread_id: 0,
    id,
    parent_id: parentId,
    return_value: optParameter(result),
    elapsed,
  };
}

function resolveParameters(args: unknown[], fun: FunctionInfo): AppMap.Parameter[] {
  return args.map(
    (value, index): AppMap.Parameter => ({
      ...parameter(value),
      name: paramName(fun.params[index]),
    }),
  );
}

function paramName(param: ESTree.Parameter | undefined): string | undefined {
  switch (param?.type) {
    case "Identifier":
      return param.name;
    case "AssignmentPattern":
      return paramName(param.left);
    // TODO: handle other parameter types
  }
}
