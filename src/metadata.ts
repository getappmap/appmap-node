import process from "node:process";

import type { PackageJson } from "type-fest";

import type AppMap from "./AppMap";
import { appName } from "./config";
import { examineException } from "./event";
import pick from "./util/pick";

// cannot use import because it's outside src
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require("../package.json") as PackageJson;

export const version = pkg.version!;

export const defaultMetadata: Partial<AppMap.Metadata> & { client: AppMap.ClientMetadata } = {
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
  app: appName,
};

export function exceptionMetadata(exc: unknown): AppMap.ExceptionMetadata | undefined {
  return pick(examineException(exc)[0], "class", "message");
}
