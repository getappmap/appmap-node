export default function fwdSlashPath(path: string): string {
  if (process.platform != "win32") return path;
  return path?.replaceAll("\\", "/");
}
