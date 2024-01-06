import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { PackageJson } from "type-fest";
import findFileUp from "./findFileUp";

export function readPkgUp(dir: string): PackageJson | undefined {
  const path = findFileUp("package.json", dir);
  if (path) return JSON.parse(readFileSync(join(path, "package.json"), "utf-8")) as PackageJson;
}
