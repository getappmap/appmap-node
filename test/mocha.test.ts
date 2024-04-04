import { integrationTest, readAppmaps, runAppmapNode, runAppmapNodeWithOptions } from "./helpers";

integrationTest("mapping Mocha tests", () => {
  expect(runAppmapNode("yarn", "mocha").status).toBeGreaterThan(0);
  expect(readAppmaps()).toMatchSnapshot();
});

integrationTest("mapping Mocha tests with process recording active", () => {
  expect(
    runAppmapNodeWithOptions(
      {
        env: { ...process.env, APPMAP_RECORDER_PROCESS_ALWAYS: "true" },
      },
      "yarn",
      "mocha",
    ).status,
  ).toBeGreaterThan(0);
  const appmaps = readAppmaps();
  const appmapsArray = Object.values(appmaps);
  expect(appmapsArray.filter((a) => a.metadata?.recorder.type == "process").length).toEqual(1);
  expect(appmapsArray.filter((a) => a.metadata?.recorder.type == "tests").length).toEqual(3);
  expect(appmaps).toMatchSnapshot();
});
