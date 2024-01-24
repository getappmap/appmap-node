import commonPathPrefix from "../commonPathPrefix";

describe(commonPathPrefix, () => {
  test.each([
    [[], ""],
    [["/foo/bar"], "/foo/"],
    [["/foo/bar", "/foo/baz"], "/foo/"],
    [["/foo/bar", "/foo/barbara"], "/foo/"],
    [["/foo/bar", "/other/dir"], "/"],
  ])("%j => %s", (paths, expected) => expect(commonPathPrefix(paths)).toBe(expected));

  if (process.platform == "win32")
    expect(commonPathPrefix(["c:\\foo\\bar", "C:\\Foo\\Baz"])).toBe("c:\\foo\\");
});
