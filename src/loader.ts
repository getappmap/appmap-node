import path, { dirname } from "node:path";
import { URL, fileURLToPath } from "node:url";

import type { NodeLoaderHooksAPI2 } from "ts-node";

import config from "./config";
import { warn } from "./message";
import transform, { findHook, getSourceMap, shouldMatchOriginalSourcePaths } from "./transform";
import { readPkgUp } from "./util/readPkgUp";
import { forceRequire } from "./register";

export const resolve: NodeLoaderHooksAPI2["resolve"] = async function resolve(
  url,
  context,
  nextResolve,
) {
  const result = await nextResolve(url, context, nextResolve);

  // For libraries, we preempt import with CommonJS require here, instead
  // of load function, because for third party libraries we can catch
  // their import name here (i.e. url: "json5"). Then it gets resolved
  // to a path (i.e. result.path: ".../node_modules/json5/lib/index.js")
  // and passed to the load function.
  if (config().getPackage(url, true) != undefined) forceRequire(url);

  return result;
};

export const load: NodeLoaderHooksAPI2["load"] = async function load(url, context, defaultLoad) {
  const urlObj = new URL(url);

  // With a custom loader, in some node versions, extensionless files (typically used
  // as main entry points inside bin folders) are treated as ESM rather than
  // CommonJS modules. This leads to TypeError [ERR_UNKNOWN_FILE_EXTENSION].
  // To fix this, we give the context.format hint to defaultLoad if we decide
  // that the file is a CommonJS module.
  if (urlObj.protocol === "file:") {
    const targetPath = fileURLToPath(urlObj);
    if (
      path.extname(targetPath).slice(1) === "" &&
      readPkgUp(dirname(targetPath))?.type !== "module"
    )
      context.format = "commonjs";
  }

  const original = await defaultLoad(url, context, defaultLoad);
  const sourceMap =
    original.source && shouldMatchOriginalSourcePaths(urlObj)
      ? getSourceMap(urlObj, original.source.toString())
      : undefined;
  const hook = findHook(urlObj, sourceMap);
  if (hook) {
    if (original.source) {
      const xformed = transform(original.source.toString(), new URL(url));

      return {
        shortCircuit: false,
        source: xformed,
        format: original.format,
      };
    } else warn("Empty source: " + url);
    return original;
  }

  // For these modules, we preempt import with CommonJS require
  // to allow our hooks to modify the loaded module in cache
  // (which is shared between ESM and CJS for builtins at least).
  if (["node:http", "node:https", "http", "https", ...config().prismaClientModuleIds].includes(url))
    forceRequire(url);

  return original;
};
