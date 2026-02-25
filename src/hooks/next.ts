import assert from "node:assert";
import { resolve } from "node:path";

import { ancestor as walk } from "acorn-walk";
import { ESTree } from "meriyah";

import type { NextConfig } from "next";
import type webpack from "webpack";

import { call_, identifier, literal, member, ret } from "../generate";
import { warn } from "../message";

// TODO: We need to patch babel as well for older or babel configured projects.
// Probable place is: ...node_modules/next/dist/compiled/babel/bundle.js.
export function shouldInstrument(url: URL): boolean {
  return url.href.endsWith("node_modules/next/dist/server/config.js");
}

export function shouldIgnore(url: URL): boolean {
  return url.href.includes("/.next/");
}

export function transform(program: ESTree.Program): ESTree.Program {
  walk(program, {
    FunctionDeclaration(fun: ESTree.FunctionDeclaration) {
      if (fun.id?.name !== "loadConfig") return;
      assert(fun.body);
      const orig: ESTree.ArrowFunctionExpression = {
        type: "ArrowFunctionExpression",
        params: [],
        body: { ...fun.body },
        async: true,
        expression: false,
      };
      const thisFile = call_(identifier("require"), literal(__filename));
      const injectConfig = member(thisFile, "injectConfig");
      fun.body.body = [ret(call_(injectConfig, orig))];
    },
  });
  return program;
}

const jsExtensions = ["tsx", "ts", "js", "cjs", "mjs", "jsx"];

export async function injectConfig(loadConfig: () => Promise<NextConfig>): Promise<NextConfig> {
  const result = await loadConfig();
  const loaderPath = resolve(__dirname, "../webpack.js");

  // Webpack loader injection (Next.js with --webpack or older Next.js)
  const orig = result.webpack;
  result.webpack = (config: webpack.Configuration, context) => {
    if (orig) config = orig(config, context) as webpack.Configuration;
    if (context.isServer && context.nextRuntime !== "edge") {
      assert(config.module?.rules);
      // Guard against the loader being added multiple times (e.g. when Next.js 16
      // invokes the webpack config callback more than once with a shared rules array).
      if (
        !config.module.rules.some(
          (r) => typeof r === "object" && r !== null && "use" in r && r.use === loaderPath,
        )
      ) {
        config.module.rules.unshift({
          test: /\.(tsx|ts|js|cjs|mjs|jsx)$/,
          use: loaderPath,
        });
      }
    }
    return config;
  };

  // Turbopack loader injection (Next.js 16+ default bundler).
  // Only inject and warn when Turbopack is actually active (i.e. --webpack / --no-turbopack not set).
  const usingWebpack = process.argv.some((a) => a === "--webpack" || a === "--no-turbopack");
  if (!usingWebpack && !process.env.APPMAP_TURBOPACK_WARNED) {
    process.env.APPMAP_TURBOPACK_WARNED = "1";
    warn(
      "AppMap Turbopack support is experimental. Files containing TypeScript-only constructs" +
        " (enum, namespace, constructor parameter properties) cannot be parsed and will not be" +
        " instrumented. For complete coverage run `next dev --webpack`.",
    );
  }

  // NextConfig has no turbopack field in its type yet, so we cast through any.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg: any = result;
  /* eslint-disable @typescript-eslint/no-unsafe-member-access */
  cfg.turbopack ??= {};
  cfg.turbopack.rules ??= {};
  for (const ext of jsExtensions) {
    const glob = `*.${ext}`;
    const existing: unknown = cfg.turbopack.rules[glob];
    const rule = { loaders: [loaderPath], condition: "node" };
    if (!existing) {
      cfg.turbopack.rules[glob] = rule;
    } else {
      // Merge with existing rules, avoiding duplicates
      const arr: unknown[] = Array.isArray(existing) ? existing : [existing];
      if (
        !arr.some(
          (r) =>
            typeof r === "object" &&
            r !== null &&
            "loaders" in r &&
            (r as { loaders: unknown[] }).loaders.some(
              (l) =>
                l === loaderPath ||
                (typeof l === "object" &&
                  l !== null &&
                  (l as { loader?: string }).loader === loaderPath),
            ),
        )
      ) {
        cfg.turbopack.rules[glob] = [rule, ...arr];
      }
    }
  }
  /* eslint-enable @typescript-eslint/no-unsafe-member-access */

  return result;
}
