import { join } from "node:path";
import { cwd } from "node:process";

export const root = cwd();
export const appMapDir = join(root, "tmp", "appmap");
