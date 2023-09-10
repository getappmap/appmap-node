import { emit } from "../appmap";
import { identifier } from "../generate";
import { record, Event } from "../recorder";
import { addFunction, functions } from "../registry";

describe(record, () => {
  it("records the function call", () => {
    const fn = jest.fn().mockImplementation(function (
      this: string,
      arg1,
      arg2,
    ) {
      expect(this).toBe("this");
      expect(arg1).toBe("arg1");
      expect(arg2).toBe("arg2");
      return "return";
    });
    const index = addFunction({
      async: false,
      generator: false,
      id: identifier("testFun"),
      params: [identifier("param0"), identifier("param1")],
      type: "FunctionDeclaration",
    });
    const result = record(
      index,
      "this",
      ["arg1", "arg2"] as unknown as IArguments,
      fn,
    );
    expect(result).toBe("return");
    expect(fn).toBeCalled();
    expect(emit).nthCalledWith<[Event]>(1, {
      type: "call",
      id: 1,
      fun: functions[index],
      args: [
        {
          class: "String",
          value: "'arg1'",
        },
        {
          class: "String",
          value: "'arg2'",
        },
      ],
      this_: {
        class: "String",
        value: "'this'",
      },
    });
    expect(emit).nthCalledWith<[Event]>(2, {
      type: "return",
      id: 2,
      parent_id: 1,
      return_value: {
        class: "String",
        value: "'return'",
      },
    });
  });
});

jest.mock("../appmap");
