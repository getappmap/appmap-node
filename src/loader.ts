import path from "node:path";
import { URL } from "node:url";

import type { NodeLoaderHooksAPI2 } from "ts-node";

import { targetPackage } from "./config";
import { warn } from "./message";
import transform, { findHook } from "./transform";

export const load: NodeLoaderHooksAPI2["load"] = async function load(url, context, defaultLoad) {
  const urlObj = new URL(url);

  // With a custom loader, in node 18, extensionless files (typically used
  // as main entry points inside bin folders) are trated as ESM rather than
  // CommonJS modules. This leads to TypeError [ERR_UNKNOWN_FILE_EXTENSION].
  // To fix this, we give the context.format hint to defaultLoad if we decide
  // that the file is a CommonJS module.
  const [major] = process.versions.node.split(".").map(Number);
  if (major == 18) {
    const ext = path.extname(urlObj.pathname).slice(1);
    if (ext == "" && urlObj.protocol == "file:" && targetPackage?.type != "module") {
      context.format = "commonjs";
    }
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

  return defaultLoad(url, context, defaultLoad);
};
