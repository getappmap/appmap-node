/** @type {import('jest').Config} */
module.exports = {
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
  rootDir: "src",
};
