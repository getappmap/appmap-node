import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import fwdSlashPath from "./util/fwdSlashPath";
import { warn } from "./message";

export default class PackageMatcher extends Array<Package> {
  constructor(
    private root: string,
    packages: Package[],
  ) {
    // Normalize path separators
    packages.forEach((p) => {
      if (p.path) p.path = fwdSlashPath(p.path);
      if (p.exclude)
        for (let i = 0; i < p.exclude.length; i++) p.exclude[i] = fwdSlashPath(p.exclude[i]);
    });

    super(...packages);
    this.resolved = new Map(
      packages.filter((p) => p.path).map(({ path }) => [path!, fwdSlashPath(resolve(root, path!))]),
    );
  }

  private resolved: Map<string, string>;

  private resolve(path: string) {
    return this.resolved.get(path) ?? fwdSlashPath(resolve(this.root, path));
  }

  private cannonicalPath(path: string) {
    if (process.platform === "win32") return path.toLowerCase();
    return path;
  }

  match(path: string): Package | undefined {
    if (path.startsWith("file:")) path = fileURLToPath(path);

    // Make sure passed path is forward slashed
    const fixedPath = fwdSlashPath(path);

    const pkg = this.find(
      (pkg) =>
        pkg.path != undefined &&
        this.cannonicalPath(fixedPath).startsWith(this.cannonicalPath(this.resolve(pkg.path))),
    );
    return pkg?.exclude?.find((ex) => fixedPath.includes(ex)) ? undefined : pkg;
  }

  matchLibrary(moduleId: string): Package | undefined {
    return this.find((pkg) => pkg.module?.replace(/^node:/, "") == moduleId.replace(/^node:/, ""));
  }
}

export interface FunctionGroup {
  names: string[];
  labels: string[];
}

export interface Package {
  path?: string;
  exclude?: string[];
  module?: string;
  shallow?: boolean;
  functions?: FunctionGroup[];
  prisma?: string; // custom prisma client module id
}

function parseFunctions(functions: unknown): FunctionGroup[] | undefined {
  if (!functions || !Array.isArray(functions)) return;

  const result: FunctionGroup[] = [];

  const toArray = (value: unknown) => (Array.isArray(value) ? value : [String(value)]) as string[];

  for (const fun of functions as unknown[]) {
    let names, labels;
    if (typeof fun === "object" && fun !== null) {
      if ("name" in fun) names = toArray(fun.name);
      if ("names" in fun) names = toArray(fun.names);
      if ("label" in fun) labels = toArray(fun.label);
      if ("labels" in fun) labels = toArray(fun.labels);
    }

    if (names && labels) result.push({ names, labels });
  }

  if (result.length > 0) return result;
}

export function parsePackages(packages: unknown): Package[] | undefined {
  if (!packages || !Array.isArray(packages)) return;

  const result: Package[] = [];

  for (const pkg of packages as unknown[]) {
    if (typeof pkg === "string") result.push({ path: pkg });
    else if (typeof pkg === "object" && pkg !== null && ("path" in pkg || "module" in pkg)) {
      const entry: Package = {};
      if ("path" in pkg) entry.path = String(pkg.path);
      if ("exclude" in pkg) entry.exclude = Array.isArray(pkg.exclude) ? pkg.exclude : [];
      if ("module" in pkg && typeof pkg.module === "string") entry.module = pkg.module;
      if ("shallow" in pkg && typeof pkg.shallow === "boolean") entry.shallow = pkg.shallow;
      if ("functions" in pkg) entry.functions = parseFunctions(pkg.functions);
      if ("prisma" in pkg && pkg.prisma != null && typeof pkg.prisma === "string")
        entry.prisma = pkg.prisma;

      if (entry.module && entry.path) {
        warn(
          "Package configuration cannot include 'path' if 'module' is specified. " +
            "Ignoring 'path' setting. ",
        );
        entry.path = undefined;
      }

      result.push(entry);
    }
  }

  if (result.length > 0) return result;
}
