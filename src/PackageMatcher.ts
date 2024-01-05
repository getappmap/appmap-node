import { resolve } from "node:path";

export default class PackageMatcher extends Array<Package> {
  constructor(
    private root: string,
    packages: Package[],
  ) {
    super(...packages);
    this.resolved = new Map(packages.map(({ path }) => [path, resolve(root, path)]));
  }

  private resolved: Map<string, string>;

  private resolve(path: string) {
    return this.resolved.get(path) ?? resolve(this.root, path);
  }

  match(path: string): Package | undefined {
    const pkg = this.find((pkg) => path.startsWith(this.resolve(pkg.path)));
    return pkg?.exclude?.find((ex) => path.includes(ex)) ? undefined : pkg;
  }
}

export interface Package {
  path: string;
  exclude?: string[];
}

export function parsePackages(packages: unknown): Package[] | undefined {
  if (!packages || !Array.isArray(packages)) return;

  const result: Package[] = [];

  for (const pkg of packages as unknown[]) {
    if (typeof pkg === "string") result.push({ path: pkg });
    else if (typeof pkg === "object" && pkg !== null && "path" in pkg) {
      const entry: Package = { path: String(pkg.path) };
      if ("exclude" in pkg) entry.exclude = Array.isArray(pkg.exclude) ? pkg.exclude : [];
      result.push(entry);
    }
  }

  if (result.length > 0) return result;
}
