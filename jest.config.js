/** @type {import('jest').Config} */
module.exports = {
  silent: true,
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
          },
        },
      },
    ],
  },
  testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/dist/", "<rootDir>/test/[^/]*/"],
};
