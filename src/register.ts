import Module from "node:module";
import transform from "./transform.js";
import { pathToFileURL } from "node:url";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Module {
      _compile: (code: string, fileName: string) => string;
    }
  }
}

const originalCompile = Module.prototype._compile;

Module.prototype._compile = function _compile(code: string, fileName: string): string {
  const xformed = transform(code, pathToFileURL(fileName));
  return originalCompile.call(this, xformed, fileName);
};
