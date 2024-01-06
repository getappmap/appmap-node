import { mkdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { chdir, cwd } from "node:process";

import tmp from "tmp";
import { PackageJson } from "type-fest";
import YAML from "yaml";

import PackageMatcher from "../PackageMatcher";
import { Config } from "../config";

tmp.setGracefulCleanup();

describe(Config, () => {
  it("respects environment variables", () => {
    process.env.APPMAP_ROOT = "/test/app";
    const config = new Config();
    expect(config).toMatchObject({
      root: "/test/app",
      relativeAppmapDir: "tmp/appmap",
      appName: "app",
      packages: new PackageMatcher("/test/app", [
        { path: ".", exclude: ["node_modules", ".yarn"] },
      ]),
    });
  });

  it("uses the current directory for root", () => {
    expect(new Config()).toMatchObject({
      root: dir,
      relativeAppmapDir: "tmp/appmap",
      appName: basename(dir),
    });
  });

  it("searches for package.json and uses package name from it", () => {
    writeFileSync("package.json", JSON.stringify({ name: "test-package" } as PackageJson));

    mkdirSync("subdirectory");
    chdir("subdirectory");
    expect(new Config()).toMatchObject({
      root: dir,
      relativeAppmapDir: "tmp/appmap",
      appName: "test-package",
    });
  });

  it("searches for appmap.yml and uses config from it", () => {
    writeFileSync(
      "appmap.yml",
      YAML.stringify({
        name: "test-package",
        appmap_dir: "appmap",
        packages: [{ path: ".", exclude: ["excluded"] }, "../lib"],
      }),
    );

    mkdirSync("subdirectory");
    chdir("subdirectory");
    expect(new Config()).toMatchObject({
      root: dir,
      relativeAppmapDir: "appmap",
      appName: "test-package",
      packages: new PackageMatcher(dir, [{ path: ".", exclude: ["excluded"] }, { path: "../lib" }]),
    });
  });

  it("uses default packages if the field in appmap.yml has unrecognized format", () => {
    writeFileSync(
      "appmap.yml",
      YAML.stringify({
        name: "test-package",
        appmap_dir: "appmap",
        packages: [{ regexp: "foo", enabled: false }],
      }),
    );

    mkdirSync("subdirectory");
    chdir("subdirectory");
    expect(new Config()).toMatchObject({
      root: dir,
      relativeAppmapDir: "appmap",
      appName: "test-package",
      packages: new PackageMatcher(dir, [{ path: ".", exclude: ["node_modules", ".yarn"] }]),
    });
  });

  let dir: string;
  beforeEach(() => {
    chdir((dir = tmp.dirSync().name));
    jest.replaceProperty(process, "env", {});
  });

  const origCwd = cwd();
  afterEach(() => chdir(origCwd));
});

describe(PackageMatcher, () => {
  it("matches packages", () => {
    const pkg = { path: ".", exclude: ["node_modules", ".yarn"] };
    const matcher = new PackageMatcher("/test/app", [pkg]);
    expect(matcher.match("/test/app/lib/foo.js")).toEqual(pkg);
    expect(matcher.match("/other/app/lib/foo.js")).toBeUndefined();
    expect(matcher.match("/test/app/node_modules/lib/foo.js")).toBeUndefined();
    expect(matcher.match("/test/app/.yarn/lib/foo.js")).toBeUndefined();
  });
});
