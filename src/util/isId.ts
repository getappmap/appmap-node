import type { ESTree } from "meriyah";

export function isId(node: ESTree.Node | null, name: string) {
  return node?.type === "Identifier" && node.name === name;
}
