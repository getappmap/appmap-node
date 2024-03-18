import NodeOptions from "../NodeOptions";

describe(NodeOptions, () => {
  it("splits the options correctly", () => {
    const options = new NodeOptions('--option "spaced argument"');
    expect(Array.from(options)).toEqual(["--option", "spaced argument"]);
  });

  it("stringifies spaced options properly", () => {
    const opts = new NodeOptions("");
    opts.push("--option", 'spaced \\argu"me\\nt');
    expect(opts.toString()).toBe('--option "spaced \\\\argu\\"me\\\\nt"');
    expect(Array.from(new NodeOptions(opts.toString()))).toEqual(Array.from(opts));
  });
});
