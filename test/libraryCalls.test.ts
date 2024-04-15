import * as AppMap from "../src/AppMap";
import { integrationTest, readAppmaps, runAppmapNode } from "./helpers";

integrationTest("mapping standard library calls", () => {
  expect(runAppmapNode("yarn", "exec", "ts-node", "index.ts").status).toBe(0);

  const appmaps = readAppmaps();
  fixAppMaps(appmaps);

  expect(appmaps).toMatchSnapshot();
});

integrationTest("mapping standard library calls - ESM", () => {
  expect(runAppmapNode("index.mjs").status).toBe(0);

  const appmaps = readAppmaps();
  fixAppMaps(appmaps);

  expect(appmaps).toMatchSnapshot();
});

// properties of "console" object can be different across node versions
function fixAppMaps(appmaps: Record<string, AppMap.AppMap>) {
  for (const key in appmaps) {
    appmaps[key].events?.forEach((e) => {
      if (e.event == "call" && "receiver" in e) delete e.receiver?.properties;
    });
  }
}
