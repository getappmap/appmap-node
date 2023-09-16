import console from "node:console";
import { inspect } from "node:util";

import chalk from "chalk";

export function info(message: unknown, ...args: unknown[]): void {
  console.info(prefix(message), ...args);
}

export function warn(message: unknown, ...args: unknown[]): void {
  console.warn(prefix(message), ...args);
}

function prefix(message: unknown): string {
  return chalk.magentaBright`(Λ) ` + (typeof message === "string" ? message : inspect(message));
}
