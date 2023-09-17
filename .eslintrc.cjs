/* eslint-env node */

/** @type {import('@typescript-eslint/utils/dist/ts-eslint').Linter.Config} */
module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  ignorePatterns: ["/dist"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/stylistic",
    "prettier",
  ],

  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  root: true,
  overrides: [
    {
      extends: [
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "plugin:@typescript-eslint/stylistic-type-checked",
      ],
      files: ["./**/*.{ts,tsx}"],
      parserOptions: {
        project: true,
        tsconfigRootDir: __dirname,
      },
    },
  ],
};
