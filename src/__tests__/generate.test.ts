import { ret } from "../generate";

describe(ret, () => {
  it("generates a return statement", () =>
    expect(ret()).toStrictEqual({ type: "ReturnStatement", argument: null }));
});
