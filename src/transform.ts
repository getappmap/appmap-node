import path from "node:path";
import { cwd } from "node:process";
import { fileURLToPath } from "node:url";
import instrument from "./instrument.js";

const root = cwd();

export default function transform(code: string, url: URL): string {
  if (url.protocol !== "file:") return code;

  const filePath = fileURLToPath(url);
  if (filePath.includes("node_modules")) return code;
  if (isUnrelated(root, filePath)) return code;

  return instrument(code, url);
}

function isUnrelated(parentPath: string, targetPath: string) {
  const rel = path.relative(parentPath, targetPath);
  return rel === targetPath || rel.startsWith("..");
}
