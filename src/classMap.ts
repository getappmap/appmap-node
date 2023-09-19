import assert from "node:assert";
import { sep } from "node:path";

import type AppMap from "./AppMap";
import type { FunctionInfo, SourceLocation } from "./registry";

type FNode = [FTree, Record<string, FunctionInfo[]>];
type FTree = Record<string, FNode>;

export function makeClassMap(funs: Iterable<FunctionInfo>): AppMap.ClassMap {
  const root: FTree = {};

  // sorting isn't strictly necessary, but it provides for a stable output
  for (const fun of sortFunctions(funs)) {
    if (!fun.location) continue;
    const pkgs = fun.location.path.replace(/\..+$/, "").split(sep).reverse();
    assert(pkgs.length > 0);

    let [tree, classes]: FNode = [root, {}];
    while (pkgs.length > 0) {
      const pkg = pkgs.pop()!;
      [tree, classes] = tree[pkg] ||= [{}, {}];
    }
    // AppMap spec requires functions to always belong to a class.
    // Free functions are common in JavaScript, so let's
    // pretend they belong to a class with an empty name.
    (classes[fun.klass ?? ""] ||= []).push(fun);
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

function makeFunction({ id, static: static_, location }: FunctionInfo): AppMap.FunctionInfo {
  assert(location);
  return {
    type: "function",
    name: id,
    static: static_,
    location: makeLocation(location),
  };
}

const collate = Intl.Collator();

function sortFunctions(funs: Iterable<FunctionInfo>): FunctionInfo[] {
  return [...funs].sort(({ location: a }, { location: b }) => {
    return collate.compare(makeLocation(a) ?? "", makeLocation(b) ?? "");
  });
}
