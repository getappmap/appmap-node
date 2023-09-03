import assert from "node:assert";
import { fileURLToPath } from "node:url";

import type { ESTree } from "meriyah";

import type { Event as AppMapEvent } from "./event.js";
import type { Parameter } from "./parameter.js";
import { Event as RecorderEvent } from "./recorder.js";
import type { FunctionInfo } from "./registry.js";
import AppMapStream from "./AppMapStream.js";
import { info } from "node:console";
import { rmSync } from "node:fs";

const stream = new AppMapStream();
process.on("exit", finish);

function resolve(event: RecorderEvent): AppMapEvent {
  const { type, id } = event;
  if (type === "call") {
    const { this_, fun, args } = event;
    const result: AppMapEvent = {
      type,
      id,
      method_id: fun.id?.name ?? "<anonymous>",
      static: !this_,
      receiver: this_,
      parameters: resolveParameters(args, fun),
    };
    if (fun.loc?.source?.startsWith("file://")) {
      // TODO make it relative to the root directory
      result.path = fileURLToPath(fun.loc.source);
      result.lineno = fun.loc.start.line;
    }
    return result;
  }
  assert(event.type === "return");
  return event;
}

export function emit(event: RecorderEvent) {
  stream.emit(resolve(event));
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

function finish() {
  stream.close();
  if (stream.seenAny) info("Wrote %s", stream.path);
  else rmSync(stream.path);
}
