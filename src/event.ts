import { ESTree } from "meriyah";

import type AppMap from "./AppMap";
import { getClass, objectId, optParameter, parameter, stringify } from "./parameter";
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

export function makeExceptionEvent(
  id: number,
  parentId: number,
  exception: unknown,
  elapsed?: number,
): AppMap.FunctionReturnEvent {
  return {
    event: "return",
    thread_id: 0,
    id,
    parent_id: parentId,
    elapsed,
    exceptions: examineException(exception),
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

export function examineException(exception: unknown): AppMap.Exception[] {
  if (!(typeof exception === "object" && exception)) return [];
  const name = getClass(exception);
  const message =
    "message" in exception && typeof exception.message === "string"
      ? exception.message
      : stringify(exception);
  const cause = "cause" in exception && exception.cause;
  // TODO establish location (needs to consult soucemap)
  return [
    {
      class: name,
      message,
      object_id: objectId(exception),
    },
    ...examineException(cause),
  ];
}
