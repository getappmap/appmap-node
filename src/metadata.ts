import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";

import type { PackageJson } from "type-fest";

import type AppMap from "./AppMap";
import { root } from "./config";

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
};

function readPkgUp(dir: string): PackageJson | undefined {
  try {
    return JSON.parse(readFileSync(join(dir, "package.json"), "utf-8")) as PackageJson;
  } catch {
    const parent = dirname(dir);
    if (parent === dir) return;
    else return readPkgUp(parent);
  }
}

const targetPackage = readPkgUp(root);

if (targetPackage?.name) defaultMetadata.app = targetPackage.name;
