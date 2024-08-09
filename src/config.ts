import assert from "node:assert";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { cwd } from "node:process";

import { PackageJson } from "type-fest";
import YAML, { Document } from "yaml";

import { info, warn } from "./message";
import PackageMatcher, { Package, parsePackages } from "./PackageMatcher";
import locateFileUp from "./util/findFileUp";
import lazyOpt from "./util/lazyOpt";
import tryOr from "./util/tryOr";

const responseBodyMaxLengthDefault = 10000;
const kResponseBodyMaxLengthEnvar = "APPMAP_RESPONSE_BODY_MAX_LENGTH";

const asyncTrackingTimeoutDefault = 3000;
const kAsyncTrackingTimeoutEnvar = "APPMAP_ASYNC_TRACKING_TIMEOUT";

export class Config {
  public readonly relativeAppmapDir: string;
  public readonly appName: string;
  public readonly root: string;
  public readonly configPath: string;
  public readonly default: boolean;
  public readonly packages: PackageMatcher;
  public readonly responseBodyMaxLength: number;
  public readonly language: string;
  // If it's 0 then no async tracking.
  public readonly asyncTrackingTimeout: number;

  // This flag controls whether a check is generated for the existence
  // of the AppMap record function in the global namespace. The check prevents
  // crashes in environments where the global/globalThis object is shadowed or
  // manipulated. This flag allows easy toggling of the check during testing.
  public readonly generateGlobalRecordHookCheck: boolean = true;

  private readonly document?: Document;
  private migrationPending = false;

  constructor(pwd = cwd()) {
    const configDir = locateFileUp("appmap.yml", process.env.APPMAP_ROOT ?? pwd);
    const packageDir = lazyOpt(() => locateFileUp("package.json", process.env.APPMAP_ROOT ?? pwd));
    const targetPackage = packageDir.then((dir) =>
      tryOr(() => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as PackageJson),
    );

    const root = (this.root = process.env.APPMAP_ROOT ?? configDir ?? packageDir() ?? pwd);

    this.configPath = join(root, "appmap.yml");
    this.document = loadConfigDocument(this.configPath);
    const config = this.document ? readConfigFile(this.document) : undefined;
    this.default = !this.document;

    this.relativeAppmapDir = config?.appmap_dir ?? "tmp/appmap";

    this.appName = config?.name ?? targetPackage()?.name ?? basename(root);

    this.language = config?.language ?? "javascript";
    this.migrationPending ||= !!config && config.language === undefined;

    this.packages = new PackageMatcher(
      root,
      config?.packages ?? [
        {
          path: ".",
          exclude: ["node_modules", ".yarn"],
        },
      ],
    );

    function getNonNegativeIntegerEnvVarValue(enVarName: string) {
      let result: number | undefined;
      if (process.env[enVarName] != undefined) {
        const value = parseInt(process.env[enVarName]!);
        result = value >= 0 ? value : undefined;
        if (result == undefined)
          warn(`Environment variable ${enVarName} must be a non-negative integer.`);
      }
      return result;
    }

    this.responseBodyMaxLength =
      getNonNegativeIntegerEnvVarValue(kResponseBodyMaxLengthEnvar) ??
      config?.response_body_max_length ??
      responseBodyMaxLengthDefault;

    this.asyncTrackingTimeout =
      getNonNegativeIntegerEnvVarValue(kAsyncTrackingTimeoutEnvar) ??
      config?.async_tracking_timeout ??
      asyncTrackingTimeoutDefault;
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

  private packageMap = new Map<string, Package | undefined>();

  getPackage(pathOrModuleId: string | undefined, isLibrary: boolean) {
    if (!pathOrModuleId) return;
    const key = `${pathOrModuleId}:${isLibrary}`;

    if (!this.packageMap.has(key)) {
      const pkg = isLibrary
        ? this.packages.matchLibrary(pathOrModuleId)
        : this.packages.match(pathOrModuleId);

      this.packageMap.set(key, pkg);
    }
    return this.packageMap.get(key);
  }

  getFunctionLabels(
    pkg: Package | undefined,
    functionName: string,
    klass?: string,
  ): string[] | undefined {
    if (!pkg?.functions) return;
    return pkg.functions
      .filter(
        (group) =>
          group.names?.includes(functionName) ??
          (klass != undefined && group.names.includes(klass + "." + functionName)),
      )
      .flatMap((group) => group.labels);
  }

  export() {
    process.env.APPMAP_ROOT = this.root;
  }

  toJSON(): ConfigFile {
    return {
      name: this.appName,
      language: this.language,
      appmap_dir: this.relativeAppmapDir,
      packages: this.packages,
    };
  }

  // For easily toggling features/fixes for testing.
  readonly fixJsonImportAssertions = true;

  migrate() {
    if (!this.migrationPending) return;

    if (this.document) {
      this.document.set("language", this.language);
    }

    info("appmap.yml requires migration, changes will be automatically applied.");
    writeFileSync(
      this.configPath,
      YAML.stringify(this.document ?? this, { keepSourceTokens: true }),
    );

    this.migrationPending = false;
  }
}

interface ConfigFile {
  appmap_dir?: string;
  name?: string;
  packages?: Package[];
  response_body_max_length?: number;
  language?: string;
  async_tracking_timeout?: number;
}

// Maintaining the YAML document is important to preserve existing comments and formatting
// in the original file.
function loadConfigDocument(path: string | undefined): Document | undefined {
  if (!path) return;

  let fileContent: string;
  try {
    fileContent = readFileSync(path, "utf-8");
  } catch (exn) {
    if (exn && typeof exn == "object" && "code" in exn && exn.code == "ENOENT") return;
    throw exn;
  }

  const document = YAML.parseDocument(fileContent, { keepSourceTokens: true });
  if (document.errors.length > 0) {
    const errorMessage = document.errors.map((e) => `${e.name}: ${e.message}`).join("\n");
    throw new Error(
      `Failed to parse config file at ${path}\n${errorMessage}\nYou can remove the file to use the default configuration.`,
    );
  }
  return document;
}

function readConfigFile(document: Document): ConfigFile {
  const config = document.toJSON() as Record<string, unknown>;
  const result: ConfigFile = {};
  assert(typeof config === "object");
  if ("name" in config) result.name = String(config.name);
  if ("appmap_dir" in config) result.appmap_dir = String(config.appmap_dir);
  if ("packages" in config) result.packages = parsePackages(config.packages);
  if ("language" in config) result.language = String(config.language);
  if ("response_body_max_length" in config) {
    const value = parseInt(String(config.response_body_max_length));
    result.response_body_max_length = value >= 0 ? value : undefined;
  }
  if ("async_tracking_timeout" in config) {
    const value = parseInt(String(config.async_tracking_timeout));
    result.async_tracking_timeout = value >= 0 ? value : undefined;
  }

  return result;
}

let instance: Config | undefined;
export default function config() {
  if (instance == undefined) {
    instance = new Config();
  }
  return instance;
}
