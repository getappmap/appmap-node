import { basename, join } from "node:path";
import { cwd } from "node:process";

import locateFileUp from "./util/findFileUp";
import { readFileSync } from "node:fs";
import { PackageJson } from "type-fest";

export class Config {
  public readonly appmapDir: string;
  public readonly appName: string;
  public readonly root: string;

  constructor() {
    const packageDir = locateFileUp("package.json", process.env.APPMAP_ROOT ?? cwd());
    const root = (this.root = process.env.APPMAP_ROOT ?? packageDir ?? cwd());
    this.appmapDir = join(root, "tmp", "appmap");
    const targetPackage = packageDir
      ? (JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as PackageJson)
      : undefined;
    this.appName = targetPackage?.name ?? basename(root);
  }

  export() {
    process.env.APPMAP_ROOT = this.root;
  }
}

export default new Config();
