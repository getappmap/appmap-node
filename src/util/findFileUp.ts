import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { cwd } from "node:process";

export default function locateFileUp(filename: string, dir = cwd()): string | undefined {
  if (existsSync(join(dir, filename))) return dir;
  const parent = dirname(dir);
  if (parent === dir) return;
  return locateFileUp(filename, parent);
}
