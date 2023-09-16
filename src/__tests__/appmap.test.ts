/* eslint-disable @typescript-eslint/unbound-method */
import { emit, finish, stream } from "../appmap";
import { identifier } from "../generate";
import { info } from "../message";

describe(emit, () => {
  it("transforms and emits call events", () => {
    emit({
      type: "call",
      args: [
        { class: "Number", value: "42" },
        { class: "String", value: "'test'" },
      ],
      fun: {
        async: false,
        generator: false,
        id: "testfun",
        loc: {
          source: "file:///test/test.js",
          start: { line: 42, column: 1 },
          end: { line: 43, column: 0 },
        },
        params: [
          identifier("testArg"),
          { type: "AssignmentPattern", left: identifier("argWithDefault") },
        ],
      },
      id: 42,
    });

    expect(stream.emit).toBeCalledWith({
      event: "call",
      id: 42,
      thread_id: 0,
      method_id: "testfun",
      path: "/test/test.js",
      lineno: 42,
      static: true,
      parameters: [
        { class: "Number", value: "42", name: "testArg" },
        { class: "String", value: "'test'", name: "argWithDefault" },
      ],
    });
  });

  it("handles anonymous functions", () => {
    emit({
      type: "call",
      args: [],
      fun: {
        async: false,
        generator: false,
        params: [],
      },
      id: 42,
    });

    expect(stream.emit).toBeCalledWith(expect.objectContaining({ method_id: "<anonymous>" }));
  });

  it("transforms and emits return events", () => {
    emit({
      type: "return",
      id: 42,
      parent_id: 40,
    });

    expect(stream.emit).toBeCalledWith({
      event: "return",
      id: 42,
      parent_id: 40,
      thread_id: 0,
    });
  });
});

describe(finish, () => {
  it("closes the stream and prints the path if anything was written", () => {
    jest.mocked(stream.close).mockReturnValue(true);
    finish();
    expect(stream.close).toHaveBeenCalled();
    expect(jest.mocked(info).mock.lastCall).toMatchSnapshot();
  });

  it("doesn't print anything if nothing was written", () => {
    jest.mocked(stream.close).mockReturnValue(false);
    finish();
    expect(stream.close).toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });
});

afterEach(jest.resetAllMocks);

Object.defineProperties(stream, {
  path: { get: () => "/test/appmap.yml", configurable: true },
  seenAny: { get: () => true, configurable: true },
});

jest.mock("../AppMapStream.ts");
jest.mock("node:fs");
jest.mock("../message");
