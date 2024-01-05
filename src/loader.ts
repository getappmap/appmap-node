import path, { dirname } from "node:path";
import { URL, fileURLToPath } from "node:url";

import type { NodeLoaderHooksAPI2 } from "ts-node";

import { warn } from "./message";
import transform, { findHook } from "./transform";
import { readPkgUp } from "./util/readPkgUp";
import { forceRequire } from "./register";

export const load: NodeLoaderHooksAPI2["load"] = async function load(url, context, defaultLoad) {
  const urlObj = new URL(url);

  // With a custom loader, in some node versions, extensionless files (typically used
  // as main entry points inside bin folders) are trated as ESM rather than
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

  const hook = findHook(urlObj);
  if (hook) {
    const original = await defaultLoad(url, context, defaultLoad);

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
  if (["node:http", "node:https", "http", "https"].includes(url)) forceRequire(url);

  return defaultLoad(url, context, defaultLoad);
};
