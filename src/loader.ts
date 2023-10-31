import type { NodeLoaderHooksAPI2 } from "ts-node";

import { warn } from "./message";
import transform, { findHook } from "./transform";

export const load: NodeLoaderHooksAPI2["load"] = async function load(url, context, defaultLoad) {
  const hook = findHook(new URL(url));
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
