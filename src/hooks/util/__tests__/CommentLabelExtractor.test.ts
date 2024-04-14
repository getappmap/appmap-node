import { ESTree, parse } from "meriyah";
import CommentLabelExtractor from "../CommentLabelExtractor";
import assert from "node:assert";

describe(CommentLabelExtractor, () => {
  it("extracts labels from code comments", () => {
    const comments: ESTree.Comment[] = [];
    const program = parse(
      `
      // @label foo
      // no labels here
      // @labels bar baz
      function a(x) {
        return x + 1;
      }

      // no label for b
      function b(x) {
        return x - 1;
      }
    `,
      { loc: true, source: "/test/test.js", onComment: comments },
    );

    const labelExtractor = new CommentLabelExtractor(comments);
    const aFunction = program.body.find(
      (x) => x.type == "FunctionDeclaration" && x.id?.name == "a",
    );
    const bFunction = program.body.find(
      (x) => x.type == "FunctionDeclaration" && x.id?.name == "b",
    );

    assert(aFunction?.loc);
    expect(labelExtractor.labelsFor(aFunction.loc.start.line)?.sort()).toEqual(
      ["foo", "bar", "baz"].sort(),
    );

    assert(bFunction?.loc);
    expect(labelExtractor.labelsFor(bFunction.loc.start.line)).toBeUndefined();
  });
});
