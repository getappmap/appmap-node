import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { chdir, cwd } from "node:process";

import tmp from "tmp";
import { PackageJson } from "type-fest";
import YAML from "yaml";

import PackageMatcher from "../PackageMatcher";
import { Config } from "../config";
import { fixAbsPath } from "../hooks/__tests__/fixAbsPath";

tmp.setGracefulCleanup();

// https://github.com/nodejs/node/issues/11422
// On MacOS, temp paths can be reported as '/var/folders/...'
// or '/private/var/folders/...' based on the API call.
// One is symlink to the other.
// This fix prevents needless test failures on local MacOS.
function fixMacOsTmpPath(path: string) {
  if (path?.startsWith("/var/folders")) return `/private${path}`;
  return path;
}

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
      root: fixMacOsTmpPath(dir),
      relativeAppmapDir: "tmp/appmap",
      appName: basename(dir),
    });
  });

  it("searches for package.json and uses package name from it", () => {
    writeFileSync("package.json", JSON.stringify({ name: "test-package" } as PackageJson));

    mkdirSync("subdirectory");
    chdir("subdirectory");
    expect(new Config()).toMatchObject({
      root: fixMacOsTmpPath(dir),
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
      root: fixMacOsTmpPath(dir),
      relativeAppmapDir: "appmap",
      appName: "test-package",
      packages: new PackageMatcher(fixMacOsTmpPath(dir), [
        { path: ".", exclude: ["excluded"] },
        { path: "../lib" },
      ]),
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
      root: fixMacOsTmpPath(dir),
      relativeAppmapDir: "appmap",
      appName: "test-package",
      packages: new PackageMatcher(fixMacOsTmpPath(dir), [
        { path: ".", exclude: ["node_modules", ".yarn"] },
      ]),
    });
  });

  it("if the appmap.yml is malformed throws with an informative message", () => {
    const malformedAppMapFileContent = "{ appmap-dir: 'abc/xyz' ";
    writeFileSync("appmap.yml", malformedAppMapFileContent);

    expect(() => new Config()).toThrowError(
      /You can remove the file to use the default configuration\.$/,
    );

    expect(readFileSync("appmap.yml").toString()).toEqual(malformedAppMapFileContent);
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
    const matcher = new PackageMatcher(fixAbsPath("/test/app"), [pkg]);
    expect(matcher.match(fixAbsPath("/test/app/lib/foo.js"))).toEqual(pkg);
    if (process.platform == "win32")
      expect(matcher.match(fixAbsPath("\\test\\app\\lib\\foo.js"))).toEqual(pkg);
    expect(matcher.match(fixAbsPath("/other/app/lib/foo.js"))).toBeUndefined();
    expect(matcher.match(fixAbsPath("/test/app/node_modules/lib/foo.js"))).toBeUndefined();
    expect(matcher.match(fixAbsPath("/test/app/.yarn/lib/foo.js"))).toBeUndefined();
  });
});
