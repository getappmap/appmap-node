import { dirname, join } from "node:path";
import { cwd } from "node:process";

import { readPkgUp } from "./util/readPkgUp";

export class Config {
  public readonly appmapDir: string;
  public readonly appName: string;

  constructor(public readonly root = process.env.APPMAP_ROOT ?? cwd()) {
    this.appmapDir = join(root, "tmp", "appmap");
    const targetPackage = readPkgUp(root);
    this.appName = targetPackage?.name ?? dirname(root);
  }

  export() {
    process.env.APPMAP_ROOT = this.root;
  }
}

export default new Config();
