import { generate } from "astring";
import { parse, type ESTree } from "meriyah";
import assert from "node:assert";
import { warn } from "node:console";
import { isNativeError } from "node:util/types";

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

  try {
    const tree = parse(code, { source: url.toString(), next: true, loc: true });
    const xformed = hook.transform(tree);
    return generate(xformed);
  } catch (e) {
    assert(isNativeError(e));
    warn("Error transforming source at %s: %s", url, e.message);
    return code;
  }
}
