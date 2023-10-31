import assert from "node:assert";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { debuglog } from "node:util";
import { isNativeError } from "node:util/types";

import { generate } from "astring";
import { fromSource as getSourceMap, removeComments } from "convert-source-map";
import { parse, type ESTree } from "meriyah";

import applySourceMap from "./applySourceMap";
import * as instrument from "./hooks/instrument";
import * as jest from "./hooks/jest";
import * as mocha from "./hooks/mocha";
import { warn } from "./message";

const treeDebug = debuglog("appmap-tree");

export interface Hook {
  shouldInstrument(url: URL): boolean;
  transform(program: ESTree.Program): ESTree.Program;
}

const defaultHooks: Hook[] = [mocha, jest, instrument];

export function findHook(url: URL, hooks = defaultHooks) {
  return hooks.find((h) => h.shouldInstrument(url));
}

export default function transform(code: string, url: URL, hooks = defaultHooks): string {
  const hook = findHook(url, hooks);
  if (!hook) return code;

  try {
    const tree = parse(code, { source: url.toString(), next: true, loc: true, module: true });
    const sourcemap: unknown = getSourceMap(fixSourceMap(url, code))?.sourcemap;
    if (sourcemap) applySourceMap(tree, sourcemap);
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

// HACK: In node 18/16, when using --loader node-ts/esm
// sourcemap gets inserted twice to the typescript file. We remove the second one
// which reflects transpiled files map, instead of the original typescript file map.
function fixSourceMap(url: URL, code: string): string {
  const [major] = process.versions.node.split(".").map(Number);
  if (major >= 20) return code;

  if (![".ts", ".mts", ".tsx"].some((e) => url.pathname.toLowerCase().endsWith(e))) return code;

  let removed = removeComments(code);
  if (removed.indexOf("//# sourceMappingURL") > -1) {
    // Correct one remains, it needs to start in new line.
    removed = removed.replace("//# sourceMappingURL", "\n//# sourceMappingURL");
    return removed;
  }
  return code;
}
