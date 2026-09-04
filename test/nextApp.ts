import { ChildProcessWithoutNullStreams } from "node:child_process";
import { IncomingMessage, request } from "node:http";

import { detachOutput, getFreePort, readAppmaps, resolveTarget, spawnAppmapNode } from "./helpers";

/**
 * The body shared by the Next.js integration tests: run `next dev` on the app
 * in the test target directory, request a couple of pages and snapshot the
 * resulting appmaps.
 */
export default async function testNextApp() {
  const port = await getFreePort();
  const { app, waitForOutput } = await spawnNextJsApp(port);
  const response = await makeRequest(port, "/hello");
  console.log("Response", response);
  const { pid } = JSON.parse(response) as { pid: number };

  await makeRequest(port, "/about");

  // An appmap is written after its response has been sent, so a request being
  // finished doesn't mean its appmap is on disk yet. Wait for next to report
  // both of them before killing it, or we can lose the last one.
  await waitForOutput("-hello.appmap.json");
  await waitForOutput("-about.appmap.json");

  // We need to kill the next process explicitly on Windows
  // because it's spawn-ed with "shell: true" and app is the shell process.
  if (process.platform == "win32") process.kill(pid, "SIGINT");
  app.kill("SIGINT");
  await new Promise((r) => app.once("exit", r));
  detachOutput(app);

  const appMaps = readAppmaps();
  // Delete response body captures because they will be different in every run
  Object.values(appMaps).forEach(
    (a) =>
      a.events?.forEach((e) => {
        if ("http_server_response" in e) delete e.http_server_response.return_value;
        if ("http_client_response" in e) delete e.http_client_response.return_value;
      }),
  );

  expect(appMaps).toMatchSnapshot();
}

async function spawnNextJsApp(port: number) {
  const nextBin = require.resolve("next/dist/bin/next", { paths: [resolveTarget()] });

  // On Windows, we give "node" argument explicitly because next is a js file with
  // shebang (#!/usr/bin/env node) which does not work on Windows.
  const app =
    process.platform == "win32"
      ? spawnAppmapNode("node", nextBin, "dev", "-p", String(port))
      : spawnAppmapNode(nextBin, "dev", "-p", String(port));

  const waitForOutput = watchOutput(app);
  await waitForOutput("Ready");
  return { app, waitForOutput };
}

/**
 * Watch the process' stdout, returning a function which waits for a fragment of
 * it to appear.
 *
 * Matching is against everything seen so far rather than individual chunks:
 * next dev interleaves spinner frames and escape sequences with its output, so
 * a message can both be split across chunk boundaries and have arrived before
 * we start waiting for it.
 */
function watchOutput(app: ChildProcessWithoutNullStreams, timeout = 30000) {
  let output = "";
  const waiters = new Set<() => void>();

  app.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString();
    for (const check of waiters) check();
  });

  return (needle: string) =>
    new Promise<void>((resolve, reject) => {
      // Fail before the test times out, so that we get to say what we waited for.
      const timer = setTimeout(() => {
        waiters.delete(check);
        reject(new Error(`Timed out waiting for ${needle} in the output:\n${output}`));
      }, timeout);
      const check = () => {
        if (!output.includes(needle)) return;
        clearTimeout(timer);
        waiters.delete(check);
        resolve();
      };
      waiters.add(check);
      check();
    });
}

async function makeRequest(port: number, path: string, method = "GET") {
  const url = new URL(path, `http://localhost:${port}`);
  const response = new Promise<IncomingMessage>((resolve, reject) => {
    const req = request(url, { method }, resolve).once("error", reject);
    req.end();
  });

  const chunks: Buffer[] = [];
  for await (const chunk of await response) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString();
}
