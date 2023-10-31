import { dirname, join } from "node:path";
import { cwd } from "node:process";

import { readPkgUp } from "./util/readPkgUp";

export const root = cwd();
export const appMapDir = join(root, "tmp", "appmap");

export const targetPackage = readPkgUp(root);
export const appName = targetPackage?.name ?? dirname(root);
