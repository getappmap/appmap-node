import type { Event as AppMapEvent } from "./event.js";
import type { ESTree } from "meriyah";
import type { Parameter } from "./parameter.js";
import { trace, Event as RecorderEvent } from "./recorder.js";
import type { Function } from "./registry.js";
import assert from "node:assert";

process.on("exit", printAppMap);

function resolve(event: RecorderEvent): AppMapEvent {
  const { type, id } = event;
  if (type === "call") {
    const { this_, fun, args } = event;
    return {
      type,
      id,
      method_id: fun.id?.name ?? "<anonymous>",
      static: !this_,
      receiver: this_,
      parameters: resolveParameters(args, fun),
    };
  }
  assert(event.type === "return");
  return event;
}

function printAppMap(): void {
  console.log(JSON.stringify(trace.map(resolve), undefined, 2));
}

function resolveParameters(args: Parameter[], fun: Function): Parameter[] {
  return args.map(
    (value, index): Parameter => ({
      ...value,
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
