import type webpack from "webpack";

import transform from "./transform";
import { pathToFileURL } from "url";

// ts-blank-space is ESM-only; cache the dynamic import so it's resolved once.
let stripperPromise: Promise<(source: string) => string> | undefined;
function getStripper() {
  return (stripperPromise ??= import("ts-blank-space").then((m) => m.default));
}

const appMapWebpackLoader: webpack.LoaderDefinition = function (source) {
  const filePath = this.resourcePath;
  const url = pathToFileURL(filePath);

  if (!/\.tsx?$/.test(filePath)) {
    return transform(source, url);
  }

  // When called from Turbopack, raw TypeScript source is passed to webpack loaders.
  // Strip type annotations with ts-blank-space (position-preserving) so meriyah
  // can parse the result. ts-blank-space is ESM-only, so we use an async loader.
  // Note: TypeScript-only constructs without a JS equivalent (enum, namespace,
  // constructor parameter properties) are left in place and will cause the parser
  // to fail, resulting in the file not being instrumented.
  const callback = this.async();
  getStripper()
    .then((strip) => {
      let code: string;
      try {
        code = strip(source);
      } catch {
        code = source;
      }
      callback(null, transform(code, url));
    })
    .catch(() => callback(null, transform(source, url)));
};

export default appMapWebpackLoader;
