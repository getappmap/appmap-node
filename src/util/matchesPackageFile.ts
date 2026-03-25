/**
 * Checks if a URL or path string matches a specific package file, handling multiple
 * node_modules layouts:
 * - Classic (npm, pnpm, yarn classic): .../node_modules/{pkg}/{file}
 * - Yarn 3 pnpm linker: .../node_modules/.store/{pkg}-npm-{ver}-{hash}/{pkg}/{file}
 * - Yarn 4 pnpm linker: .../node_modules/.store/{pkg}-npm-{ver}-{hash}/package/{file}
 */
export function matchesPackageFile(
  urlOrPath: string,
  packageName: string,
  filePath: string,
): boolean {
  if (urlOrPath.endsWith(`/${packageName}/${filePath}`)) return true;
  // Yarn 4 pnpm linker uses 'package' as the subdirectory name inside .store entries
  if (urlOrPath.endsWith(`/package/${filePath}`)) {
    // Yarn 4 pnpm linker names store entries as:
    //   @scope/pkg → @scope-pkg-npm-ver-hash or @scope-pkg-virtual-hash
    //   pkg         → pkg-npm-ver-hash or pkg-virtual-hash
    const sanitized = packageName.replace("/", "-");
    if (
      urlOrPath.includes(`/.store/${sanitized}-npm-`) ||
      urlOrPath.includes(`/.store/${sanitized}-virtual-`)
    )
      return true;
  }
  return false;
}
