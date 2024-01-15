import assert from "node:assert";
import { resolve } from "node:path";

import { ancestor as walk } from "acorn-walk";
import { ESTree } from "meriyah";

import type { NextConfig } from "next";
import type webpack from "webpack";

import { call_, identifier, literal, member, ret } from "../generate";

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

export async function injectConfig(loadConfig: () => Promise<NextConfig>): Promise<NextConfig> {
  const result = await loadConfig();
  const orig = result.webpack;
  result.webpack = (config: webpack.Configuration, context) => {
    if (orig) config = orig(config, context) as webpack.Configuration;
    if (context.isServer) {
      assert(config.module?.rules);
      config.module.rules.unshift({
        test: /\.(tsx|ts|js|cjs|mjs|jsx)$/,
        use: resolve(__dirname, "../webpack.js"),
      });
    }
    return config;
  };

  return result;
}
