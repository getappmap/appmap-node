import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist",
      "test/*/.next/**",
      "test/sourceMapPath/built/index.js",
      "test/sourceMapPath/built/index-esm.mjs",
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs.stylistic,
  eslintConfigPrettier,
  {
    plugins: { prettier },
    languageOptions: {
      globals: {
        ...globals.es2021,
        ...globals.node,
      },
    },
    rules: {
      "prettier/prettier": "error",
      "no-console": "error",
    },
  },
  {
    files: ["test/**"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["test/httpClient/**", "test/jest/**"],
    languageOptions: {
      globals: globals.jest,
    },
  },
  {
    files: ["test/mocha/**"],
    languageOptions: {
      globals: globals.mocha,
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
