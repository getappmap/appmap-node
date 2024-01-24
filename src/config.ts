import assert from "node:assert";
import { readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { cwd } from "node:process";

import { PackageJson } from "type-fest";
import YAML from "yaml";

import PackageMatcher, { Package, parsePackages } from "./PackageMatcher";
import locateFileUp from "./util/findFileUp";
import lazyOpt from "./util/lazyOpt";
import tryOr from "./util/tryOr";

export class Config {
  public readonly relativeAppmapDir: string;
  public readonly appName: string;
  public readonly root: string;
  public readonly configPath: string;
  public readonly default: boolean;
  public readonly packages: PackageMatcher;

  constructor(pwd = cwd()) {
    const configDir = locateFileUp("appmap.yml", process.env.APPMAP_ROOT ?? pwd);
    const packageDir = lazyOpt(() => locateFileUp("package.json", process.env.APPMAP_ROOT ?? pwd));
    const targetPackage = packageDir.then((dir) =>
      tryOr(() => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as PackageJson),
    );

    const root = (this.root = process.env.APPMAP_ROOT ?? configDir ?? packageDir() ?? pwd);

    this.configPath = join(root, "appmap.yml");
    const config = readConfigFile(this.configPath);
    this.default = !config;

    this.relativeAppmapDir = config?.appmap_dir ?? "tmp/appmap";

    this.appName = config?.name ?? targetPackage()?.name ?? basename(root);

    this.packages = new PackageMatcher(
      root,
      config?.packages ?? [
        {
          path: ".",
          exclude: ["node_modules", ".yarn"],
        },
      ],
    );
  }

  private absoluteAppmapDir?: string;
  get appmapDir() {
    return (this.absoluteAppmapDir ||= resolve(this.root, this.relativeAppmapDir));
  }

  export() {
    process.env.APPMAP_ROOT = this.root;
  }

  toJSON(): ConfigFile {
    return {
      name: this.appName,
      appmap_dir: this.relativeAppmapDir,
      packages: this.packages,
    };
  }
}

interface ConfigFile {
  appmap_dir?: string;
  name?: string;
  packages?: Package[];
}

function readConfigFile(path: string | undefined): ConfigFile | undefined {
  if (!path) return;
  const config = tryOr(() => YAML.parse(readFileSync(path, "utf8")) as unknown);
  if (!config) return;

  const result: ConfigFile = {};
  assert(typeof config === "object");
  if ("name" in config) result.name = String(config.name);
  if ("appmap_dir" in config) result.appmap_dir = String(config.appmap_dir);
  if ("packages" in config) result.packages = parsePackages(config.packages);

  return result;
}

export default new Config();
