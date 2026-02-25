import type webpack from "webpack";

import transform from "./transform";
import { pathToFileURL } from "url";

// When called from Turbopack, webpack loaders receive raw TypeScript source.
// meriyah (our parser) doesn't support TypeScript syntax, so we strip types first.
// Node.js 22.6+ provides stripTypeScriptTypes in node:module.
function tryStripTypeScriptTypes(source: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { stripTypeScriptTypes } = require("node:module") as {
      stripTypeScriptTypes?: (source: string, options?: { mode: string }) => string;
    };
    return stripTypeScriptTypes?.(source, { mode: "strip" }) ?? source;
  } catch {
    return source;
  }
}

const appMapWebpackLoader: webpack.LoaderDefinition = function (source) {
  const filePath = this.resourcePath;
  const url = pathToFileURL(filePath);
  // When called from Turbopack, raw TypeScript source is passed to webpack loaders.
  // Strip TypeScript type annotations so meriyah can parse the code.
  const code = /\.tsx?$/.test(filePath) ? tryStripTypeScriptTypes(source) : source;
  return transform(code, url);
};

export default appMapWebpackLoader;
