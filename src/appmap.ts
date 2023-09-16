import assert from "node:assert";
import process from "node:process";
import { fileURLToPath } from "node:url";

import type { ESTree } from "meriyah";

import type { Event as AppMapEvent } from "./event";
import { info } from "./message";
import type { Parameter } from "./parameter";
import { Event as RecorderEvent } from "./recorder";
import type { FunctionInfo } from "./registry";
import AppMapStream from "./AppMapStream";
import compactObject from "./util/compactObject";

export const stream = new AppMapStream();
process.on("exit", finish);

function resolve(event: RecorderEvent): AppMapEvent {
  const { type, id } = event;
  if (type === "call") {
    const { this_, fun, args } = event;
    const result: AppMapEvent = {
      event: type,
      id,
      thread_id: 0,
      method_id: fun.id ?? "<anonymous>",
      static: !this_,
      receiver: this_,
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
  assert(event.type === "return");
  return {
    event: "return",
    thread_id: 0,
    id: event.id,
    parent_id: event.parent_id,
    return_value: event.return_value,
  };
}

export function emit(event: RecorderEvent) {
  stream.emit(compactObject(resolve(event)));
}

function resolveParameters(args: Parameter[], fun: FunctionInfo): Parameter[] {
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

export function finish() {
  if (stream.close()) info("Wrote %s", stream.path);
}
