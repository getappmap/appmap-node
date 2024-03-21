const { setTimeout } = require("timers/promises");
const { queue } = require("async");

const lambda1 = async (r) => {
  await setTimeout(1, r);
};

describe("jest test with async library", () => {
  it("instrumented lambda does not cause timeout", async () => {
    const q = queue(lambda1, 2);
    q.push("task1");
    q.push("task2");
    if (!q.idle()) await q.drain();
  });
});
