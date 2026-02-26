import { ESTree } from "meriyah";
import { SourceMapConsumer } from "source-map-js";

export default class CommentLabelExtractor {
  private lineToComment = new Map<number, ESTree.Comment>();

  constructor(
    public comments: ESTree.Comment[],
    public sourceMap?: SourceMapConsumer,
  ) {
    const singleLineComments = this.comments.filter((c) => c.type === "SingleLine");
    singleLineComments.forEach((c) => {
      const line = this.locate(c.loc);
      if (line) this.lineToComment.set(line, c);
    });
  }

  private locate(loc: ESTree.Node["loc"]): number | undefined {
    if (!loc) return undefined;
    if (this.sourceMap) {
      const mapped = this.sourceMap.originalPositionFor(loc.start);
      if (mapped?.line) return mapped.line;
    } else return loc.start.line;
  }

  labelsFor(funStartLine: number) {
    const labels = new Set<string>();

    // @label or @labels can be specified in a single line comment
    // within continuous single line comments preceding a function:
    //   // @labels l1 l2 l3
    //   // @label l4
    //   function f() { ... }
    for (let line = funStartLine - 1; line > 0; line--) {
      const comment = this.lineToComment.get(line);
      if (!comment) break;

      const match = /^\s*@labels?\s+(.*)/.exec(comment.value);
      const lineLabels = match?.[1].split(/\s+/).filter((item) => item.length > 0);

      lineLabels?.forEach((l) => labels.add(l));
    }

    if (labels.size > 0) return Array.from(labels);
  }
}
