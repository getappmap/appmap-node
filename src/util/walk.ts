import {
  simple as acornSimple,
  ancestor as acornAncestor,
  type RecursiveVisitors,
} from "acorn-walk";
import type { ESTree } from "meriyah";

/**
 * Why is this necessary?
 * The project uses `meriyah` to parse code into an ESTree AST, and `acorn-walk` to traverse it.
 * Recent updates to `acorn-walk`'s TypeScript definitions made them stricter, expecting AST nodes
 * that strictly match `acorn.Node` (where `start` and `end` are strictly `number`, and other
 * properties have acorn-specific types). `meriyah`'s `ESTree.Node` defines `start` and `end` as
 * `number | undefined` and has minor structural typing differences. This mismatch causes
 * TypeScript compilation errors when passing meriyah nodes to acorn-walk.
 *
 * Why is this safe?
 * At runtime, `acorn-walk` only relies on the `type` property of the node and standard ESTree
 * child properties to perform the traversal. It does not strictly validate the types or rely on
 * acorn-specific fields that differ from standard ESTree. We use `@ts-expect-error` to bypass
 * the strict compiler checks internally while providing a strongly typed ESTree interface for
 * the rest of the application.
 */

// Define a type for ESTree simple visitors
export type ESTreeSimpleVisitors<TState = unknown> = {
  [Type in ESTree.Node["type"]]?: (
    node: Extract<ESTree.Node, { type: Type }>,
    state: TState,
  ) => void;
};

// Define a type for ESTree ancestor visitors
export type ESTreeAncestorVisitors<TState = unknown> = {
  [Type in ESTree.Node["type"]]?: (
    node: Extract<ESTree.Node, { type: Type }>,
    state: TState,
    ancestors: ESTree.Node[],
  ) => void;
};

// Strongly typed wrappers for acorn-walk
export function walkSimple<TState = unknown>(
  node: ESTree.Node,
  visitors: ESTreeSimpleVisitors<TState>,
  base?: RecursiveVisitors<TState>,
  state?: TState,
): void {
  // @ts-expect-error adapter for acorn-walk
  acornSimple(node, visitors, base, state);
}

export function walkAncestor<TState = unknown>(
  node: ESTree.Node,
  visitors: ESTreeAncestorVisitors<TState>,
  base?: RecursiveVisitors<TState>,
  state?: TState,
): void {
  // @ts-expect-error adapter for acorn-walk
  acornAncestor(node, visitors, base, state);
}
