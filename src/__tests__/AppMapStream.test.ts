import fs from "node:fs";
import { chdir, cwd } from "node:process";

import tmp from "tmp";

import AppMapStream from "../AppMapStream";

tmp.setGracefulCleanup();

describe(AppMapStream, () => {
  const origCwd = cwd();

  beforeEach(() => chdir(tmp.dirSync().name));
  afterEach(() => chdir(origCwd));

  it("creates an appmap file in current directory", () => {
    const stream = new AppMapStream("./test.appmap.json");
    expect(stream.seenAny).toBe(false);

    stream.emit({ event: "call" });
    stream.emit({ event: "return" });
    expect(stream.close()).toBe(true);

    expect(stream.seenAny).toBe(true);

    const { path } = stream;
    const output: unknown = JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));

    expect(output).toStrictEqual({
      events: [{ event: "call" }, { event: "return" }],
    });
  });

  it("only creates the file when the first event is sent", () => {
    jest.spyOn(fs, "openSync");
    const stream = new AppMapStream("./test.appmap.json");
    expect(stream.seenAny).toBe(false);
    expect(stream.close()).toBe(false);
    expect(fs.openSync).not.toBeCalled();
  });
});
