import type { ESTree } from "meriyah";

export function isId(node: ESTree.Node | null, name?: string): node is ESTree.Identifier {
  if (node?.type !== "Identifier") return false;
  if (name && node.name !== name) return false;
  return true;
}
