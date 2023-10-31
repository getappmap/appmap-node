import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { PackageJson } from "type-fest";

export function readPkgUp(dir: string): PackageJson | undefined {
  try {
    return JSON.parse(readFileSync(join(dir, "package.json"), "utf-8")) as PackageJson;
  } catch {
    const parent = dirname(dir);
    if (parent === dir) return;
    else return readPkgUp(parent);
  }
}
