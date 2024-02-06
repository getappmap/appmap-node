import assert from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { URL, fileURLToPath } from "node:url";
import { debuglog } from "node:util";
import { isNativeError } from "node:util/types";

import { generate } from "astring";
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

function getSourceMap(fileUrl: URL, code: string): SourceMapConsumer | undefined {
  const sourceMappingUrl = code.match(/\/\/# sourceMappingURL=(.*)/)?.[1];
  if (!sourceMappingUrl) return;

  const sourceMapUrl = new URL(sourceMappingUrl, fileUrl);

  let sourceMap: RawSourceMap;

  switch (sourceMapUrl.protocol) {
    case "data:":
      sourceMap = JSON.parse(parseDataUrl(sourceMapUrl)) as RawSourceMap;
      break;
    case "file:":
      fileUrl = sourceMapUrl;
      sourceMap = JSON.parse(readFileSync(fileURLToPath(sourceMapUrl), "utf8")) as RawSourceMap;
      break;
    default:
      throw new Error(`Unsupported source map protocol: ${sourceMapUrl.protocol}`);
  }

  sourceMap.sources = sourceMap.sources.map((source) => {
    const url = new URL((sourceMap.sourceRoot ?? "") + source, fileUrl);
    return url.protocol === "file:" ? fileURLToPath(url) : url.toString();
  });

  return new SourceMapConsumer(sourceMap);
}

function parseDataUrl(fileUrl: URL) {
  assert(fileUrl.protocol === "data:");
  const [type, data] = fileUrl.pathname.split(",", 2);
  return Buffer.from(
    decodeURIComponent(data),
    type.endsWith("base64") ? "base64" : "utf8",
  ).toString("utf8");
}
