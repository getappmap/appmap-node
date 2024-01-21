import assert from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { URL, fileURLToPath } from "node:url";
import { debuglog } from "node:util";
import { isNativeError } from "node:util/types";

import { generate } from "astring";
import * as SourceMapConverter from "convert-source-map";
import { parse, type ESTree } from "meriyah";
import { RawSourceMap, SourceMapConsumer } from "source-map-js";

import * as instrument from "./hooks/instrument";
import * as jest from "./hooks/jest";
import * as mocha from "./hooks/mocha";
import * as next from "./hooks/next";
import * as vitest from "./hooks/vitest";
import { warn } from "./message";

const debug = debuglog("appmap");
const treeDebug = debuglog("appmap-tree");
const sourceDebug = debuglog("appmap-source");

export interface Hook {
  shouldInstrument(url: URL): boolean;
  transform(program: ESTree.Program, sourcemap?: SourceMapConsumer): ESTree.Program;
  shouldIgnore?(url: URL): boolean;
}

const defaultHooks: Hook[] = [next, vitest, mocha, jest, instrument];

export function findHook(url: URL, hooks = defaultHooks) {
  return hooks.find((h) => h.shouldInstrument(url));
}

export default function transform(code: string, url: URL, hooks = defaultHooks): string {
  const hook = findHook(url, hooks);
  if (!hook) return code;

  if (hooks.some((h) => h.shouldIgnore?.(url))) return code;

  try {
    const tree = parse(code, { source: url.toString(), next: true, loc: true, module: true });
    const xformed = hook.transform(tree, getSourceMap(url, code));
    if (treeDebug.enabled) dumpTree(xformed, url);
    const src = generate(xformed);
    if (sourceDebug.enabled) {
      const outputPath = fileURLToPath(url) + ".xformed";
      writeFileSync(outputPath, src);
      sourceDebug("wrote transformed source to %s", outputPath);
    }
    return src;
  } catch (e) {
    assert(isNativeError(e));
    warn("Error transforming source at %s: %s", url, e.message);
    if (debug.enabled && e.stack) debug(e.stack);
    return code;
  }
}

function dumpTree(xformed: ESTree.Program, url: URL) {
  if (url.protocol !== "file:") return;
  const path = fileURLToPath(url) + ".appmap-tree.json";
  writeFileSync(path, JSON.stringify(xformed, null, 2));
  treeDebug("wrote transformed tree to %s", path);
}

function getSourceMap(url: URL, code: string): SourceMapConsumer | undefined {
  if (
    process.versions.node.split(".").map(Number) < [18, 19] &&
    [".ts", ".mts", ".tsx"].some((e) => url.pathname.toLowerCase().endsWith(e))
  ) {
    // HACK: In node 18.18, when using --loader node-ts/esm
    // sourcemap gets inserted twice to the typescript file. We remove the second one
    // which reflects transpiled files map, instead of the original typescript file map.
    code = SourceMapConverter.removeComments(code);
    if (code.indexOf("//# sourceMappingURL") > -1)
      // Correct one remains, it needs to start in new line.
      code.replace("//# sourceMappingURL", "\n//# sourceMappingURL");
  }

  const readFile = (filename: string) => {
    const fileUrl = new URL(filename, url);
    switch (fileUrl.protocol) {
      case "file:":
        return readFileSync(fileUrl, "utf8");
      case "data:":
        return parseDataUrl(fileUrl);
      default:
        throw new Error(`unhandled protocol reading source map: ${fileUrl.protocol}`);
    }
  };

  const map = SourceMapConverter.fromMapFileSource(code, readFile);
  if (map) return new SourceMapConsumer(map.sourcemap as RawSourceMap);
}

function parseDataUrl(fileUrl: URL) {
  assert(fileUrl.protocol === "data:");
  const [type, data] = fileUrl.pathname.split(",", 2);
  return Buffer.from(
    decodeURIComponent(data),
    type.endsWith("base64") ? "base64" : "utf8",
  ).toString("utf8");
}
