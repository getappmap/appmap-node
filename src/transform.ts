import assert from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { URL, fileURLToPath, pathToFileURL } from "node:url";
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
import config from "./config";

const debug = debuglog("appmap");
const treeDebug = debuglog("appmap-tree");
const sourceDebug = debuglog("appmap-source");

export interface Hook {
  shouldInstrument(url: URL, sourcemap?: CustomSourceMapConsumer): boolean;
  transform(
    program: ESTree.Program,
    sourcemap?: CustomSourceMapConsumer,
    comments?: ESTree.Comment[],
  ): ESTree.Program;
  shouldIgnore?(url: URL): boolean;
}

const defaultHooks: Hook[] = [next, vitest, mocha, jest, instrument];

export function findHook(url: URL, sourceMap?: CustomSourceMapConsumer, hooks = defaultHooks) {
  return hooks.find((h) => h.shouldInstrument(url, sourceMap));
}

export function shouldMatchOriginalSourcePaths(url: URL) {
  // We're not interested in source maps of libraries. For instance, in a Next.js project,
  // if we were to consult the source map for instrumentation of a file like
  // "...node_modules/next/dist/compiled/next-server/pages.runtime.dev.js", we would get
  // URLs like "file:///...webpack:/next/dist/compiled/cookie/index.js" that do not include
  // the node_modules part, resulting in unintended instrumentation, since node_modules
  // folder is typically excluded from instrumentation.
  return !["/node_modules/", "/.next/"].some((x) => url.pathname.includes(x));
}

export default function transform(code: string, url: URL, hooks = defaultHooks): string {
  let sourceMap: CustomSourceMapConsumer | undefined;
  let sourceMapInitialized = false;
  const getSourceMap_ = () => {
    if (!sourceMapInitialized) {
      try {
        sourceMap = getSourceMap(url, code);
      } catch (e) {
        warn("Error getting source map for ", url, e);
      }
      sourceMapInitialized = true;
    }
    return sourceMap;
  };

  if (shouldMatchOriginalSourcePaths(url)) getSourceMap_();

  const hook = findHook(url, sourceMap, hooks);
  if (!hook) return code;

  if (hooks.some((h) => h.shouldIgnore?.(url))) return code;

  if (config().fixJsonImportAssertions) {
    // Meriyah does not support old import-assertions.
    // Replace import-assertions with the import-attributes syntax
    // for json imports.
    const regex = /assert\s*\{/g;
    code = code.replace(regex, "with {");
  }

  try {
    const comments: ESTree.Comment[] = [];
    const tree = parse(code, {
      source: url.toString(),
      next: true,
      loc: true,
      module: true,
      onComment: comments,
    });

    const xformed = hook.transform(tree, getSourceMap_(), comments);
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

export class CustomSourceMapConsumer extends SourceMapConsumer {
  public originalSources: URL[];
  constructor(rawSourceMap: RawSourceMap) {
    super(rawSourceMap);
    this.originalSources = rawSourceMap.sources.map((s) => pathToFileURL(s));
  }
}

export function getSourceMap(fileUrl: URL, code: string): CustomSourceMapConsumer | undefined {
  const sourceMappingUrl = /\/\/# sourceMappingURL=(.*)/.exec(code)?.[1];
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
    const rootedSource = (sourceMap.sourceRoot ?? "") + source;
    // On Windows, we get incorrect result with URL if the original path contains spaces.
    //   source: 'C:/Users/John Doe/projects/appmap-node/test/typescript/index.ts'
    //   => result: 'C:/Users/John%20Doe/projects/appmap-node/test/typescript/index.ts'
    // This check prevents it.
    if (/^[a-zA-Z]:[/\\]/.exec(rootedSource)) return rootedSource;

    const url = new URL(rootedSource, fileUrl);
    return url.protocol === "file:" ? fileURLToPath(url) : url.toString();
  });

  return new CustomSourceMapConsumer(sourceMap);
}

function parseDataUrl(fileUrl: URL) {
  assert(fileUrl.protocol === "data:");
  const [type, data] = fileUrl.pathname.split(",", 2);
  return Buffer.from(
    decodeURIComponent(data),
    type.endsWith("base64") ? "base64" : "utf8",
  ).toString("utf8");
}
