import assert from "node:assert";
import { readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { cwd } from "node:process";

import { PackageJson } from "type-fest";
import YAML from "yaml";

import { warn } from "./message";
import PackageMatcher, { Package, parsePackages } from "./PackageMatcher";
import locateFileUp from "./util/findFileUp";
import lazyOpt from "./util/lazyOpt";
import tryOr from "./util/tryOr";
import { isNativeError } from "node:util/types";

const responseBodyMaxLengthDefault = 10000;
const kResponseBodyMaxLengthEnvar = "APPMAP_RESPONSE_BODY_MAX_LENGTH";

export class Config {
  public readonly relativeAppmapDir: string;
  public readonly appName: string;
  public readonly root: string;
  public readonly configPath: string;
  public readonly default: boolean;
  public readonly packages: PackageMatcher;
  public readonly responseBodyMaxLength: number;

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

    let envResponseBodyMaxLength: number | undefined;
    if (process.env[kResponseBodyMaxLengthEnvar] != undefined) {
      const value = parseInt(process.env[kResponseBodyMaxLengthEnvar]);
      envResponseBodyMaxLength = value >= 0 ? value : undefined;
      if (envResponseBodyMaxLength == undefined)
        warn(`Environment variable ${kResponseBodyMaxLengthEnvar} must be a non-negative integer.`);
    }

    this.responseBodyMaxLength =
      envResponseBodyMaxLength ?? config?.response_body_max_length ?? responseBodyMaxLengthDefault;
  }

  private absoluteAppmapDir?: string;
  get appmapDir() {
    return (this.absoluteAppmapDir ||= resolve(this.root, this.relativeAppmapDir));
  }

  get prismaClientModuleIds(): string[] {
    const result = ["@prisma/client"];
    this.packages.forEach((p) => {
      if (p.prisma) result.push(p.prisma);
    });
    return result;
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
  response_body_max_length?: number;
}

function readConfigFile(path: string | undefined): ConfigFile | undefined {
  if (!path) return;

  let fileContent: string;
  try {
    fileContent = readFileSync(path, "utf-8");
  } catch (exn) {
    if (exn && typeof exn == "object" && "code" in exn && exn.code == "ENOENT") return;
    throw exn;
  }

  let config;
  try {
    config = YAML.parse(fileContent) as unknown;
  } catch (exn) {
    assert(isNativeError(exn));
    throw new Error(
      `Error parsing config file at ${path}: ${exn.message}\nYou can remove the file to use the default configuration.`,
    );
  }
  if (!config) return;

  const result: ConfigFile = {};
  assert(typeof config === "object");
  if ("name" in config) result.name = String(config.name);
  if ("appmap_dir" in config) result.appmap_dir = String(config.appmap_dir);
  if ("packages" in config) result.packages = parsePackages(config.packages);
  if ("response_body_max_length" in config) {
    const value = parseInt(String(config.response_body_max_length));
    result.response_body_max_length = value >= 0 ? value : undefined;
  }

  return result;
}

export default new Config();
