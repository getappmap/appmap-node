import * as message from "../message";
import console from "node:console";

for (const fun of ["info", "warn"] as const) {
  describe(message[fun], () => {
    it("prefixes the message", () => {
      message[fun]("test");
      expect(console[fun]).lastCalledWith(expect.stringMatching(/.*(Λ).*test$/));
    });
  });
}

console.info = jest.fn();
console.warn = jest.fn();
