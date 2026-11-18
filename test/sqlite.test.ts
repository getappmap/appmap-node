import { integrationTest, readAppmap, runAppmapNode, runAppmapNodeWithOptions } from "./helpers";

integrationTest("mapping Sqlite tests", () => {
  expect(runAppmapNode("index.js").status).toBe(0);
  expect(readAppmap()).toMatchSnapshot();
});

integrationTest("mapping a query slower than the async tracking timeout", () => {
  const options = { env: { ...process.env, APPMAP_ASYNC_TRACKING_TIMEOUT: "100" } };
  expect(runAppmapNodeWithOptions(options, "slow.js").status).toBe(0);
  const { events = [], eventUpdates = {} } = readAppmap();
  const queries = events.flatMap((e, idx) => ("sql_query" in e ? [idx] : []));
  expect(queries).toHaveLength(2);
  // each query is directly followed by its return, however long it takes
  for (const idx of queries)
    expect(events[idx + 1]).toMatchObject({ event: "return", parent_id: events[idx].id });
  // and the failing one records the error
  const failed = events[queries[1] + 1];
  expect({ ...failed, ...eventUpdates[failed.id] }).toMatchObject({
    exceptions: [{ message: expect.stringContaining("malformed JSON") as unknown }],
  });
});
