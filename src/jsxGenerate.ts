import { GENERATOR } from "astring";
import type { State } from "astring";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any;
type Handler = (this: Dispatch, node: Node, state: State) => void;
type Dispatch = Record<string, Handler>;

// Handlers for JSX AST node types not covered by astring's default GENERATOR.
// Each handler writes the node to the code generation state; child nodes are
// dispatched through `this`, which is the generator object itself.
//
// All handlers access `node` properties via dynamic keys — the `any` type is
// intentional since meriyah ships no JSX type definitions.
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
const jsxHandlers: Dispatch = {
  JSXElement(node: Node, state: State) {
    this[node.openingElement.type](node.openingElement, state);
    for (const child of node.children) this[child.type](child, state);
    if (node.closingElement) this[node.closingElement.type](node.closingElement, state);
  },

  JSXOpeningElement(node: Node, state: State) {
    state.write("<", node);
    this[node.name.type](node.name, state);
    for (const attr of node.attributes) {
      state.write(" ");
      this[attr.type](attr, state);
    }
    state.write(node.selfClosing ? "/>" : ">");
  },

  JSXClosingElement(node: Node, state: State) {
    state.write("</");
    this[node.name.type](node.name, state);
    state.write(">");
  },

  JSXFragment(node: Node, state: State) {
    this[node.openingFragment.type](node.openingFragment, state);
    for (const child of node.children) this[child.type](child, state);
    this[node.closingFragment.type](node.closingFragment, state);
  },

  JSXOpeningFragment(_node: Node, state: State) {
    state.write("<>");
  },

  JSXClosingFragment(_node: Node, state: State) {
    state.write("</>");
  },

  JSXIdentifier(node: Node, state: State) {
    state.write(node.name, node);
  },

  JSXMemberExpression(node: Node, state: State) {
    this[node.object.type](node.object, state);
    state.write(".");
    this[node.property.type](node.property, state);
  },

  JSXNamespacedName(node: Node, state: State) {
    this[node.namespace.type](node.namespace, state);
    state.write(":");
    this[node.name.type](node.name, state);
  },

  JSXAttribute(node: Node, state: State) {
    this[node.name.type](node.name, state);
    if (node.value !== null) {
      state.write("=");
      this[node.value.type](node.value, state);
    }
  },

  JSXSpreadAttribute(node: Node, state: State) {
    state.write("{...");
    this[node.argument.type](node.argument, state);
    state.write("}");
  },

  JSXExpressionContainer(node: Node, state: State) {
    state.write("{");
    this[node.expression.type](node.expression, state);
    state.write("}");
  },

  JSXEmptyExpression() {
    // nothing to write — used in {/* comment */} and <>{}</>
  },

  JSXText(node: Node, state: State) {
    state.write(node.value, node);
  },

  JSXSpreadChild(node: Node, state: State) {
    state.write("{...");
    this[node.expression.type](node.expression, state);
    state.write("}");
  },
};
/* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

// Astring generator extended with JSX node handlers.
// Usage: generate(ast, { generator: jsxGenerator })
export const jsxGenerator = Object.assign(
  {} as typeof GENERATOR & Record<string, (node: Node, state: State) => void>,
  GENERATOR,
  jsxHandlers,
);
