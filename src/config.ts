import assert from "node:assert";
import { readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { cwd } from "node:process";

import { PackageJson } from "type-fest";
import YAML from "yaml";

import locateFileUp from "./util/findFileUp";
import lazyOpt from "./util/lazyOpt";
import tryOr from "./util/tryOr";

export class Config {
  public readonly appmapDir: string;
  public readonly appName: string;
  public readonly root: string;

  constructor(pwd = cwd()) {
    const configDir = locateFileUp("appmap.yml", process.env.APPMAP_ROOT ?? pwd);
    const config = readConfigFile(configDir);

    const packageDir = lazyOpt(() => locateFileUp("package.json", process.env.APPMAP_ROOT ?? pwd));
    const targetPackage = packageDir.then((dir) =>
      tryOr(() => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as PackageJson),
    );

    const root = (this.root = process.env.APPMAP_ROOT ?? configDir ?? packageDir() ?? pwd);

    this.appmapDir = config?.appmap_dir ?? join(root, "tmp", "appmap");

    this.appName = config?.name ?? targetPackage()?.name ?? basename(root);
  }

  export() {
    process.env.APPMAP_ROOT = this.root;
  }
}

interface ConfigFile {
  appmap_dir?: string;
  name?: string;
}

function readConfigFile(dir: string | undefined): ConfigFile | undefined {
  if (!dir) return;
  const config = tryOr(() => YAML.parse(readFileSync(join(dir, "appmap.yml"), "utf8")) as unknown);
  if (!config) return;

  const result: ConfigFile = {};
  assert(typeof config === "object");
  if ("name" in config) result.name = String(config.name);
  if ("appmap_dir" in config) result.appmap_dir = resolve(dir, String(config.appmap_dir));
  return result;
}

export default new Config();
