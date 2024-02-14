import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fwdSlashPath from "./util/fwdSlashPath";

export default class PackageMatcher extends Array<Package> {
  constructor(
    private root: string,
    packages: Package[],
  ) {
    // Normalize path separators
    packages.forEach((p) => {
      p.path = fwdSlashPath(p.path);
      if (p.exclude)
        for (let i = 0; i < p.exclude.length; i++) p.exclude[i] = fwdSlashPath(p.exclude[i]);
    });

    super(...packages);
    this.resolved = new Map(packages.map(({ path }) => [path, fwdSlashPath(resolve(root, path))]));
  }

  private resolved: Map<string, string>;

  private resolve(path: string) {
    return this.resolved.get(path) ?? fwdSlashPath(resolve(this.root, path));
  }

  match(path: string): Package | undefined {
    if (path.startsWith("file:")) path = fileURLToPath(path);

    // Make sure passed path is forward slashed
    const fixedPath = fwdSlashPath(path);

    const pkg = this.find((pkg) => fixedPath.startsWith(this.resolve(pkg.path)));
    return pkg?.exclude?.find((ex) => fixedPath.includes(ex)) ? undefined : pkg;
  }
}

export interface Package {
  path: string;
  exclude?: string[];
  prisma?: string; // custom prisma client module id
}

export function parsePackages(packages: unknown): Package[] | undefined {
  if (!packages || !Array.isArray(packages)) return;

  const result: Package[] = [];

  for (const pkg of packages as unknown[]) {
    if (typeof pkg === "string") result.push({ path: pkg });
    else if (typeof pkg === "object" && pkg !== null && "path" in pkg) {
      const entry: Package = { path: String(pkg.path) };
      if ("exclude" in pkg) entry.exclude = Array.isArray(pkg.exclude) ? pkg.exclude : [];
      if ("prisma" in pkg && pkg.prisma != null && typeof pkg.prisma === "string")
        entry.prisma = pkg.prisma;
      result.push(entry);
    }
  }

  if (result.length > 0) return result;
}
