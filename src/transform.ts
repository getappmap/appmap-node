import { generate } from "astring";
import { parse, type ESTree } from "meriyah";
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { debuglog } from "node:util";
import { isNativeError } from "node:util/types";

import * as instrument from "./hooks/instrument";
import * as jest from "./hooks/jest";
import { warn } from "./message";
import { writeFileSync } from "node:fs";

const treeDebug = debuglog("appmap-tree");

export interface Hook {
  shouldInstrument(url: URL): boolean;
  transform(program: ESTree.Program): ESTree.Program;
}

const defaultHooks: Hook[] = [jest, instrument];

export default function transform(code: string, url: URL, hooks = defaultHooks): string {
  const hook = hooks.find((h) => h.shouldInstrument(url));
  if (!hook) return code;

  try {
    const tree = parse(code, { source: url.toString(), next: true, loc: true });
    const xformed = hook.transform(tree);
    if (treeDebug.enabled) dumpTree(xformed, url);
    return generate(xformed);
  } catch (e) {
    assert(isNativeError(e));
    warn("Error transforming source at %s: %s", url, e.message);
    return code;
  }
}

function dumpTree(xformed: ESTree.Program, url: URL) {
  if (url.protocol !== "file:") return;
  const path = fileURLToPath(url) + ".appmap-tree.json";
  writeFileSync(path, JSON.stringify(xformed, null, 2));
  treeDebug("wrote transformed tree to %s", path);
}
