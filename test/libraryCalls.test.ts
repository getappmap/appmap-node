import { integrationTest, readAppmaps, runAppmapNode } from "./helpers";

integrationTest("mapping standard library calls", () => {
  expect(runAppmapNode("yarn", "exec", "ts-node", "index.ts").status).toBe(0);

  const appmaps = readAppmaps();
  // properties of "console" object can be different accross node versions
  for (const key in appmaps) {
    appmaps[key].events?.forEach((e) => {
      if (e.event == "call" && "receiver" in e) delete e.receiver?.properties;
    });
  }

  expect(appmaps).toMatchSnapshot();
});
