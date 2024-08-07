import assert from "node:assert";
import type http from "node:http";
import type { ClientRequest, IncomingMessage, ServerResponse } from "node:http";
import type https from "node:https";
import { URL } from "node:url";

import type * as AppMap from "../AppMap";
import config from "../config";
import { info, warn } from "../message";
import { parameter } from "../parameter";
import {
  getActiveRecordings,
  getRemoteRecording,
  getRequestRecording,
  isActive,
  startProcessRecording,
  startRemoteRecording,
  startRequestRecording,
} from "../recorder";
import { getTime } from "../util/getTime";
import { readFile, rm } from "node:fs/promises";

type HTTP = typeof http | typeof https;

// keep track of createServer proxies to avoid double-wrapping
const proxies = new WeakSet<object>();

export default function httpHook(mod: HTTP) {
  if (!proxies.has(mod.createServer)) {
    const proxy = new Proxy(mod.createServer, {
      apply(target, thisArg, argArray: Parameters<typeof mod.createServer>) {
        const server = target.apply(thisArg, argArray);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        server.emit = new Proxy(server.emit, {
          apply(target, thisArg, [event, ...args]: [string, ...unknown[]]) {
            if (event === "request") {
              const [request, response] = args as [IncomingMessage, ServerResponse];
              if (request.url === "/_appmap/record") {
                handleRemoteRecording(request, response);
                return true;
              }
              handleRequest(request, response);
            }
            return Reflect.apply(target, thisArg, [event, ...args]) as boolean;
          },
        });
        return server;
      },
    });
    proxies.add(proxy);
    mod.createServer = proxy;
  }

  hookClientRequestApi(mod);

  return mod;
}

httpHook.applicable = function (id: string) {
  return ["http", "https", "node:http", "node:https"].includes(id);
};

function hookClientRequestApi(mod: HTTP) {
  const createApplyProxy = (f: HTTP["get" | "request"]) => {
    return new Proxy(f, {
      apply(target, thisArg, argArray: Parameters<typeof f>) {
        const clientRequest = target.apply(thisArg, argArray);
        handleClientRequest(clientRequest);
        return clientRequest;
      },
    });
  };

  mod.request = createApplyProxy(mod.request);
  mod.get = createApplyProxy(mod.get);

  if ("ClientRequest" in mod) {
    mod.ClientRequest = new Proxy(mod.ClientRequest, {
      construct(target, argArray, newTarget): object {
        const clientRequest = Reflect.construct(target, argArray, newTarget) as ClientRequest;
        handleClientRequest(clientRequest);
        return clientRequest;
      },
    });
  }
}

const clientRequests = new WeakSet<http.ClientRequest>();

const warnRecordingNotRunning = (url: URL) =>
  warn("appmap recording is not running, skipping recording of request %s", url.href);

function handleClientRequest(request: http.ClientRequest) {
  // for some reason proxy construct/apply is called multiple times for the same request
  // so let's make sure we haven't seen this one before
  if (clientRequests.has(request)) return;
  clientRequests.add(request);

  const startTime = getTime();
  request.on("finish", () => {
    const url = extractRequestURL(request);
    const recordings = getActiveRecordings();
    // recording may have finished at this point
    if (recordings.length == 0) {
      warnRecordingNotRunning(url);
      return;
    }

    // Setting port to the default port for the protocol makes it empty string.
    // See: https://nodejs.org/api/url.html#urlport
    url.port = request.socket?.remotePort + "";

    const urlString = `${url.protocol}//${url.host}${url.pathname}`;
    const headers = normalizeHeaders(request.getHeaders());
    const clientRequestEvents = recordings.map((r) =>
      r.httpClientRequest(request.method, urlString, headers),
    );

    request.on("response", (response) => {
      const capture = new BodyCapture();
      response.on("data", (chunk: Chunk) => {
        capture.push(chunk);
      });

      response.once("end", () => {
        const elapsed = getTime() - startTime;
        const headers = normalizeHeaders(response.headers);
        const returnValue = capture.createReturnValue(
          response.headers["content-type"]?.startsWith("application/json") ?? false,
        );

        if (getActiveRecordings().length == 0) {
          warnRecordingNotRunning(url);
          return;
        }

        recordings.forEach((recording, idx) => {
          assert(response.statusCode != undefined);
          if (!isActive(recording)) return;

          recording.httpClientResponse(
            clientRequestEvents[idx].id,
            elapsed,
            response.statusCode,
            headers,
            returnValue,
          );
        });
      });
    });
  });
}

function extractRequestURL(request: ClientRequest): URL {
  let { protocol, host } = request;
  /* nock OverridenClientRequest stores protocol and host on options instead */
  if ("options" in request && request.options && typeof request.options === "object") {
    protocol = getStringField(request.options, "protocol") ?? protocol;
    host = getStringField(request.options, "host") ?? host;
  }

  return new URL(`${protocol}//${host}${request.path}`);
}

let remoteRunning = false;

// TODO: return ![next, ...].some(h => h.shouldIgnoreRequest?.(request))
function shouldIgnoreRequest(request: http.IncomingMessage) {
  if (request.url?.includes("/_next/static/")) return true;
  if (request.url?.includes("/_next/image/")) return true;
  if (request.url?.endsWith(".ico")) return true;
  if (request.url?.endsWith(".svg")) return true;
  return false;
}

type Chunk = string | Buffer | Uint8Array;
class BodyCapture {
  private chunks: Buffer[] = [];
  private currentLength = 0;
  private totalBodyLength = 0;

  push(chunk: Chunk, encoding?: BufferEncoding) {
    if (!chunk) return;
    this.totalBodyLength += chunk.length;
    if (config().responseBodyMaxLength <= this.currentLength) return;

    if (typeof chunk === "string") chunk = Buffer.from(chunk, encoding);
    this.chunks.push(Buffer.from(chunk));
    this.currentLength += chunk.length;
  }

  createReturnValue(isJson: boolean) {
    let returnValue: AppMap.Parameter | undefined;
    let caputuredBodyString: string = Buffer.concat(this.chunks).toString("utf8");
    if (caputuredBodyString.length > config().responseBodyMaxLength)
      caputuredBodyString = caputuredBodyString.substring(0, config().responseBodyMaxLength);

    if (caputuredBodyString.length > 0) {
      // If it's truncated add the rider
      if (this.totalBodyLength > caputuredBodyString.length) {
        const truncatedLength = this.totalBodyLength - caputuredBodyString.length;
        caputuredBodyString += `... (${truncatedLength} more characters)`;
      } else if (isJson) {
        // Not truncated, try to parse JSON and make it a Parameter
        try {
          const obj: unknown = JSON.parse(caputuredBodyString);
          returnValue = parameter(obj);
        } catch {
          /* Cannot be parsed */
        }
      }
      if (returnValue == undefined)
        returnValue = { class: "[ResponseBody]", value: caputuredBodyString };
    }
    return returnValue;
  }
}

function captureResponseBody(response: http.ServerResponse, capture: BodyCapture) {
  const originalWrite = response.write.bind(response);
  const originalEnd = response.end.bind(response);

  type WriteCallback = (error: Error | null | undefined) => void;

  response.write = function (
    chunk: Chunk,
    encoding?: BufferEncoding | WriteCallback,
    callback?: WriteCallback,
  ) {
    if (typeof encoding === "function") {
      callback = encoding;
      encoding = undefined;
    }

    capture.push(chunk, encoding);

    if (encoding != null) return originalWrite(chunk, encoding, callback);
    return originalWrite(chunk, callback);
  };

  type EndCallback = () => void;

  response.end = function (
    chunk?: Chunk | EndCallback,
    encoding?: BufferEncoding | EndCallback,
    callback?: EndCallback,
  ) {
    if (!chunk || typeof chunk === "function") {
      return originalEnd(chunk);
    } else if (typeof encoding === "function") {
      callback = encoding;
      encoding = undefined;
    }

    capture.push(chunk, encoding);

    if (encoding != null) return originalEnd(chunk, encoding, callback);
    return originalEnd(chunk, callback);
  };
}

function handleRequest(request: http.IncomingMessage, response: http.ServerResponse) {
  if (!(request.method && request.url)) return;

  if (shouldIgnoreRequest(request)) return;

  const url = new URL(request.url, "http://example");
  const testRunning = getActiveRecordings().some((r) => r.metadata.recorder.type == "tests");
  const timestamp = remoteRunning || testRunning ? undefined : startRequestRecording(url.pathname);

  const method = request.method;
  const headers = normalizeHeaders(request.headers);
  const protocol = `HTTP/${request.httpVersion}`;
  const recordings = getActiveRecordings();
  const requestEvents = recordings.map((r) =>
    r.httpRequest(method, url.pathname, protocol, headers, url.searchParams),
  );

  const capture = new BodyCapture();
  captureResponseBody(response, capture);

  const startTime = getTime();
  response.once("finish", () => {
    const contentType = response.getHeader("Content-Type");
    const isJson = typeof contentType == "string" && contentType.startsWith("application/json");

    const elapsed = getTime() - startTime;
    const headers = normalizeHeaders(response.getHeaders());
    const returnValue = capture.createReturnValue(isJson);

    recordings.forEach((recording, idx) => {
      if (!isActive(recording)) return;
      if (fixupEvent(request, requestEvents[idx])) recording.fixup(requestEvents[idx]);

      recording.httpResponse(
        requestEvents[idx].id,
        elapsed,
        response.statusCode,
        headers,
        returnValue,
      );
    });

    // If there is a test or remote recording we don't create a separate request recording
    // appmap, so we don't have to finish it.
    const testRunning = recordings.some((r) => r.metadata.recorder.type == "tests");
    if (remoteRunning || testRunning) return;

    const recording = getRequestRecording();
    const { request_method, path_info } = requestEvents[0].http_server_request;
    recording.metadata.name = `${request_method} ${path_info} (${response.statusCode}) — ${timestamp}`;
    recording.finish();
    info("Wrote %s", recording.path);
    startProcessRecording(); // just so there's always a recording running
  });
}

function fixupEvent(req: http.IncomingMessage, event: AppMap.HttpServerRequestEvent): boolean {
  const normalizedPath = getNormalizedPath(req);
  const params = [...getParams(req, "params"), ...getParams(req, "body")];

  const pathAvailable = !!normalizedPath && normalizedPath !== event.http_server_request.path_info;
  const paramsAvailable = params.length > 0;

  if (pathAvailable) event.http_server_request.normalized_path_info = normalizedPath;
  if (paramsAvailable) (event.message ||= []).unshift(...params);

  return pathAvailable || paramsAvailable;
}

function getNormalizedPath(req: http.IncomingMessage) {
  if ("route" in req) {
    const route = req.route;
    if (typeof route === "object" && route && "path" in route && typeof route.path === "string")
      return route.path;
  }
}

function getStringField(obj: object, field: string): string | undefined {
  const v = getField(obj, field);
  if (v && typeof v === "string") return v;
}

function getField(obj: object, field: string): unknown {
  if (field in obj) return (obj as never)[field];
}

function getParams(req: http.IncomingMessage, field: string): AppMap.Parameter[] {
  const params = getField(req, field);
  if (params && typeof params === "object") {
    return Object.entries(params).map(([k, v]) => ({
      name: k,
      ...parameter(v),
    }));
  }
  return [];
}

function normalizeHeaders(
  headers: http.IncomingHttpHeaders | http.OutgoingHttpHeaders,
): Record<string, string> | undefined {
  const result: Record<string, string> = {};

  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined) continue;

    const key = k.split("-").map(capitalize).join("-");
    if (v instanceof Array) result[key] = v.join("\n");
    else result[key] = String(v);
  }

  return result;
}

function capitalize(str: string): string {
  return str[0].toUpperCase() + str.slice(1).toLowerCase();
}

function handleRemoteRecording(
  req: http.IncomingMessage,
  res: http.ServerResponse<http.IncomingMessage>,
): void {
  switch (req.method) {
    case "GET":
      res.writeHead(200);
      res.end(JSON.stringify({ enabled: remoteRunning }));
      break;
    case "POST":
      if (remoteRunning) res.writeHead(409).end("Recording is already in progress");
      else {
        res.writeHead(200);
        remoteRunning = true;
        res.end("Recording started");
        startRemoteRecording();
      }
      break;
    case "DELETE":
      if (remoteRunning) {
        remoteRunning = false;
        const recording = getRemoteRecording();
        const reset = () => {
          info("Remote recording finished");
          startProcessRecording(); // just so there's always a recording running
        };
        if (recording.finish()) {
          res.writeHead(200);
          const { path } = recording;
          void (async () => {
            res.end(await readFile(path));
            await rm(path);
            reset();
          })();
        } else {
          res.writeHead(200).end("{}");
          reset();
        }
      } else res.writeHead(404).end("No recording is in progress");
      break;
    default:
      res.statusCode = 405;
      res.end("Method Not Allowed");
  }
}
