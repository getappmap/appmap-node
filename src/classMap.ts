import assert from "node:assert";

import type * as AppMap from "./AppMap";
import config from "./config";
import type { FunctionInfo, SourceLocation } from "./registry";

type FNode = [FTree, Record<string, FunctionInfo[]>];
type FTree = Record<string, FNode>;

export function makeClassMap(funs: Iterable<FunctionInfo>): AppMap.ClassMap {
  const root: FTree = {};

  // sorting isn't strictly necessary, but it provides for a stable output
  for (const fun of sortFunctions(funs)) {
    if (!fun.location) continue;
    // fun.location can contain "/" as separator even in Windows
    const pkgs = fun.location.path.split(/[/\\]/).reverse().slice(1);
    // add app name as fallback top level package
    pkgs.push(config.appName);

    let [tree, classes]: FNode = [root, {}];
    while (pkgs.length > 0) {
      const pkg = pkgs.pop()!;
      [tree, classes] = tree[pkg] ||= [{}, {}];
    }
    (classes[fun.klassOrFile] ||= []).push(fun);
  }

  let result = makeTree(root);
  while (result.length == 1) {
    const [{ children }] = result;
    assert(children);
    if (!children.every(({ type }) => type === "package")) break;
    result = children as AppMap.Package[]; // checked above
  }

  return result;
}

function makeTree(tree: FTree): AppMap.ClassMap {
  return Object.entries(tree).map(([name, [subtree, classes]]) => ({
    name,
    type: "package",
    children: [...makeTree(subtree), ...makeClasses(classes)],
  }));
}

function makeClasses(classes: Record<string, FunctionInfo[]>): AppMap.Class[] {
  return Object.entries(classes).map(([name, funs]) => ({
    type: "class",
    name,
    children: funs.map(makeFunction),
  }));
}

function makeLocation(l?: SourceLocation): string | undefined {
  if (!l) return;
  return [l.path, l.lineno].join(":");
}

function makeFunction({
  id,
  static: static_,
  location,
  labels,
}: FunctionInfo): AppMap.FunctionInfo {
  assert(location);
  return {
    type: "function",
    name: id,
    static: static_,
    location: makeLocation(location),
    labels,
  };
}

const collate = Intl.Collator();

function sortFunctions(funs: Iterable<FunctionInfo>): FunctionInfo[] {
  return [...funs].sort(({ location: a }, { location: b }) => {
    return collate.compare(makeLocation(a) ?? "", makeLocation(b) ?? "");
  });
}
