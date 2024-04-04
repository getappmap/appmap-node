import { integrationTest, readAppmaps, runAppmapNode, runAppmapNodeWithOptions } from "./helpers";

integrationTest("mapping Jest tests", () => {
  expect(runAppmapNode("yarn", "jest", "test", "--color").status).toBe(1);
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
      "test",
      "--color",
    ).status,
  ).toBe(1);
  const appmaps = readAppmaps();
  const appmapsArray = Object.values(appmaps);
  expect(appmapsArray.filter((a) => a.metadata?.recorder.type == "process").length).toEqual(1);
  expect(appmapsArray.filter((a) => a.metadata?.recorder.type == "tests").length).toEqual(5);
  expect(appmaps).toMatchSnapshot();
});
