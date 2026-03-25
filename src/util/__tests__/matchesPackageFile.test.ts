import { matchesPackageFile } from "../matchesPackageFile";

describe("matchesPackageFile", () => {
  describe("classic layout (npm, pnpm, yarn classic)", () => {
    it("matches a simple package", () => {
      expect(
        matchesPackageFile("/app/node_modules/mocha/lib/runner.js", "mocha", "lib/runner.js"),
      ).toBe(true);
    });

    it("matches a scoped package", () => {
      expect(
        matchesPackageFile(
          "/app/node_modules/@vitest/runner/dist/index.js",
          "@vitest/runner",
          "dist/index.js",
        ),
      ).toBe(true);
    });

    it("matches inside a nested node_modules", () => {
      expect(
        matchesPackageFile(
          "/app/node_modules/some-dep/node_modules/mocha/lib/runner.js",
          "mocha",
          "lib/runner.js",
        ),
      ).toBe(true);
    });

    it("does not match a different package with the same file path", () => {
      expect(
        matchesPackageFile(
          "/app/node_modules/jest-runtime/build/index.js",
          "jest-circus",
          "build/index.js",
        ),
      ).toBe(false);
    });

    it("does not match a package whose name is a suffix of another", () => {
      expect(
        matchesPackageFile("/app/node_modules/mocha-extra/lib/runner.js", "mocha", "lib/runner.js"),
      ).toBe(false);
    });

    it("does not match when the file path differs", () => {
      expect(
        matchesPackageFile("/app/node_modules/mocha/lib/mocha.js", "mocha", "lib/runner.js"),
      ).toBe(false);
    });

    it("does not match when the separator before the package name is missing", () => {
      expect(matchesPackageFile("xmocha/lib/runner.js", "mocha", "lib/runner.js")).toBe(false);
    });
  });

  describe("Yarn 4 pnpm linker layout (.store/pkg-npm-ver-hash/package/)", () => {
    it("matches a simple package with npm store entry", () => {
      expect(
        matchesPackageFile(
          "/app/node_modules/.store/mocha-npm-10.2.0-abc123def/package/lib/runner.js",
          "mocha",
          "lib/runner.js",
        ),
      ).toBe(true);
    });

    it("matches a simple package with virtual store entry", () => {
      expect(
        matchesPackageFile(
          "/app/node_modules/.store/mocha-virtual-abc123def/package/lib/runner.js",
          "mocha",
          "lib/runner.js",
        ),
      ).toBe(true);
    });

    it("matches a scoped package (slash replaced with dash in store name)", () => {
      expect(
        matchesPackageFile(
          "/app/node_modules/.store/@vitest-runner-npm-1.6.0-abc123/package/dist/index.js",
          "@vitest/runner",
          "dist/index.js",
        ),
      ).toBe(true);
    });

    it("matches with a multi-segment file path", () => {
      expect(
        matchesPackageFile(
          "/app/node_modules/.store/vite-npm-5.0.0-abc123/package/dist/node/module-runner.js",
          "vite",
          "dist/node/module-runner.js",
        ),
      ).toBe(true);
    });

    it("does not match when store entry is for a different package", () => {
      expect(
        matchesPackageFile(
          "/app/node_modules/.store/jest-runtime-npm-29.0.0-abc123/package/build/index.js",
          "jest-circus",
          "build/index.js",
        ),
      ).toBe(false);
    });

    it("does not match /package/ path without a .store prefix", () => {
      expect(
        matchesPackageFile("/app/some-dir/package/lib/runner.js", "mocha", "lib/runner.js"),
      ).toBe(false);
    });

    it("does not match when package name is a prefix of the store entry name", () => {
      expect(
        matchesPackageFile(
          "/app/node_modules/.store/mocha-extra-npm-1.0.0-abc123/package/lib/runner.js",
          "mocha",
          "lib/runner.js",
        ),
      ).toBe(false);
    });
  });

  describe("Yarn 3 pnpm linker layout (.store/pkg-npm-ver-hash/pkg/)", () => {
    it("matches a simple package", () => {
      expect(
        matchesPackageFile(
          "/app/node_modules/.store/mocha-npm-10.2.0-abc123/mocha/lib/runner.js",
          "mocha",
          "lib/runner.js",
        ),
      ).toBe(true);
    });

    it("matches a scoped package", () => {
      expect(
        matchesPackageFile(
          "/app/node_modules/.store/@vitest-runner-npm-1.6.0-abc123/@vitest/runner/dist/index.js",
          "@vitest/runner",
          "dist/index.js",
        ),
      ).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("returns false for an empty string", () => {
      expect(matchesPackageFile("", "mocha", "lib/runner.js")).toBe(false);
    });

    it("matches when the path starts directly with the package/file suffix", () => {
      expect(matchesPackageFile("/mocha/lib/runner.js", "mocha", "lib/runner.js")).toBe(true);
    });
  });
});
