import { full as walk } from "acorn-walk";
import { type ESTree } from "meriyah";
import { RawSourceMap, SourceMapConsumer } from "source-map-js";

export default function applySourceMap(tree: ESTree.Program, sourcemap: unknown): void {
  const map = new SourceMapConsumer(sourcemap as RawSourceMap);
  walk(tree, ({ loc }: ESTree.Node) => {
    if (!loc) return;
    const mapped = map.originalPositionFor(loc.start);
    loc.source = mapped.source;
    loc.start = mapped;
    loc.end = map.originalPositionFor(loc.end);
  });
}
