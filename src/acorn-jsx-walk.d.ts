declare module "acorn-jsx-walk" {
  /** Extends an acorn-walk base visitor with handlers for all JSX node types. */
  export function extend(base: Record<string, unknown>): void;
}
