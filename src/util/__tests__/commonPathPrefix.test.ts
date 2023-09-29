import commonPathPrefix from "../commonPathPrefix";

describe(commonPathPrefix, () => {
  test.each([
    [[], ""],
    [["/foo/bar"], "/foo/"],
    [["/foo/bar", "/foo/baz"], "/foo/"],
    [["/foo/bar", "/foo/barbara"], "/foo/"],
    [["/foo/bar", "/other/dir"], "/"],
  ])("%j => %s", (paths, expected) => expect(commonPathPrefix(paths)).toBe(expected));
});
