import { chdir, cwd } from "node:process";

import tmp from "tmp";

import { Config } from "../config";
import { basename, join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { PackageJson } from "type-fest";

tmp.setGracefulCleanup();

describe(Config, () => {
  it("respects environment variables", () => {
    process.env.APPMAP_ROOT = "/test/app";
    expect(new Config()).toMatchObject({
      root: "/test/app",
      appmapDir: "/test/app/tmp/appmap",
      appName: "app",
    });
  });

  it("uses the current directory for root", () => {
    expect(new Config()).toMatchObject({
      root: dir,
      appmapDir: join(dir, "tmp", "appmap"),
      appName: basename(dir),
    });
  });

  it("searches for package.json and uses package name from it", () => {
    writeFileSync("package.json", JSON.stringify({ name: "test-package" } as PackageJson));

    mkdirSync("subdirectory");
    chdir("subdirectory");
    expect(new Config()).toMatchObject({
      root: dir,
      appmapDir: join(dir, "tmp", "appmap"),
      appName: "test-package",
    });
  });
});

let dir: string;
beforeEach(() => {
  chdir((dir = tmp.dirSync().name));
  jest.replaceProperty(process, "env", {});
});

const origCwd = cwd();
afterEach(() => chdir(origCwd));
