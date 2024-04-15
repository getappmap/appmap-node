import * as AppMap from "../src/AppMap";
import { integrationTest, readAppmap, runAppmapNode } from "./helpers";

integrationTest("mapping labeled functions", () => {
  expect(runAppmapNode("index.js").status).toBe(0);
  const appmap = fixAppMap(readAppmap());
  expect(appmap).toMatchSnapshot();
});

integrationTest("mapping labeled functions - TypeScript", () => {
  expect(runAppmapNode("yarn", "exec", "ts-node", "index.ts").status).toBe(0);
  const appmap = fixAppMap(readAppmap());
  expect(appmap).toMatchSnapshot();
});

// properties of "console" object can be different across node versions
function fixAppMap(appmap: AppMap.AppMap) {
  appmap.events?.forEach((e) => {
    if (e.event == "call" && "receiver" in e) delete e.receiver?.properties;
  });
  return appmap;
}
