import { hrtime } from "node:process";

export function getTime(): number {
  const [sec, nano] = hrtime();
  return sec + nano / 1000000000;
}
