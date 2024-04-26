import { format } from "node:util";

import { integrationTest, readAppmaps, runAppmapNode, runAppmapNodeWithOptions } from "./helpers";

integrationTest("mapping Jest tests", () => {
  expect(runAppmapNode("yarn", "jest", "calc", "--color").status).toBe(1);
  expect(runAppmapNode("yarn", "jest", "asyncLib", "--color").status).toBe(0);
  expect(readAppmaps()).toMatchSnapshot();
});

integrationTest("mapping Jest tests with process recording active", () => {
  expect(
    runAppmapNodeWithOptions(
      {
        env: { ...process.env, APPMAP_RECORDER_PROCESS_ALWAYS: "true" },
      },
      "yarn",
      "jest",
      "calc",
      "--color",
    ).status,
  ).toBe(1);
  const appmaps = readAppmaps();
  expect(appmaps).toMatchSnapshot();

  const appmapsArray = Object.values(appmaps);

  const processMaps = Object.entries(appmaps).filter(
    ([, a]) => a.metadata?.recorder.type == "process",
  );
  if (processMaps.length != 1)
    throw new Error(format("expected one process appmap, got: ", Object.fromEntries(processMaps)));
  expect(appmapsArray.filter((a) => a.metadata?.recorder.type == "tests").length).toEqual(4);
});
