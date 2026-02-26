import process from "node:process";

import type { PackageJson } from "type-fest";

import type * as AppMap from "./AppMap";
import config from "./config";
import { examineException } from "./event";
import pick from "./util/pick";

// cannot use import because it's outside src
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require("../package.json") as PackageJson;

export const version = pkg.version!;

let defaultMetadata: Partial<AppMap.Metadata> & { client: AppMap.ClientMetadata };
export const getDefaultMetadata = () => {
  return (defaultMetadata ??= {
    client: {
      name: pkg.name!,
      version,
      url: pkg.homepage!,
    },
    language: {
      name: "javascript",
      engine: "Node.js",
      version: process.version,
    },
    app: config().appName,
  });
};

export function exceptionMetadata(error: unknown): AppMap.ExceptionMetadata | undefined {
  const [exc] = examineException(error);
  if (exc) return pick(exc, "class", "message");
  if (typeof error === "string") return { message: error, class: "String" };
}
