import { sep } from "node:path";

export default function commonPathPrefix(paths: string[]): string {
  const [first, ...others] = paths;
  if (!first) return "";

  let prefixLen = 0;
  for (let i = 0; i < first.length; i++)
    if (!others.every((path) => path[i] === first[i])) break;
    else if (first[i] === sep) prefixLen = i;

  return first.slice(0, prefixLen + 1);
}
