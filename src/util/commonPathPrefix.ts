import { sep } from "node:path";

export default function commonPathPrefix(paths: string[]): string {
  const [first, ...others] = paths;
  if (!first) return "";

  const isEqual = (a: string, b: string) => {
    return process.platform == "win32"
      ? a.localeCompare(b, "en", { sensitivity: "base" }) == 0
      : a == b;
  };

  let prefixLen = 0;
  for (let i = 0; i < first.length; i++)
    if (!others.every((path) => isEqual(path[i], first[i]))) break;
    // We occasionally convert back slash to forward slash even in Windows
    else if (first[i] === sep || first[i] === "/") prefixLen = i;

  return first.slice(0, prefixLen + 1);
}
