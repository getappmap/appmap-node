// Add drive parts for absolute paths in Windows.
export function fixAbsPath(pathOrFileUrl: string) {
  if (process.platform != "win32") return pathOrFileUrl;
  if (pathOrFileUrl.startsWith("/") || pathOrFileUrl.startsWith("\\")) return "F:" + pathOrFileUrl;
  return pathOrFileUrl.replace("file:///", "file:///F:/");
}
