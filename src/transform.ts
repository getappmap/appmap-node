import { generate } from "astring";
import { parse, type ESTree } from "meriyah";

import * as instrument from "./hooks/instrument";
import * as jest from "./hooks/jest";

export interface Hook {
  shouldInstrument(url: URL): boolean;
  transform(program: ESTree.Program): ESTree.Program;
}

const hooks: Hook[] = [jest, instrument];

export default function transform(code: string, url: URL): string {
  const hook = hooks.find((h) => h.shouldInstrument(url));
  if (!hook) return code;

  const tree = parse(code, { source: url.toString(), next: true });
  const xformed = hook.transform(tree);
  return generate(xformed);
}
