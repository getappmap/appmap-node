import assert from "node:assert";
import { readFileSync, rmSync } from "node:fs";
import type http from "node:http";
import type { ClientRequest, IncomingMessage, ServerResponse } from "node:http";
import type https from "node:https";
import { URL } from "node:url";

import type AppMap from "../AppMap";
import Recording from "../Recording";
import { info, warn } from "../message";
import { parameter } from "../parameter";
import { recording, start } from "../recorder";
import { getTime } from "../util/getTime";

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
    // recording may have finished at this point
    if (!recording.running) {
      warnRecordingNotRunning(url);
      return;
    }

    // Setting port to the default port for the protocol makes it empty string.
    // See: https://nodejs.org/api/url.html#urlport
    url.port = request.socket?.remotePort + "";
    const clientRequestEvent = recording.httpClientRequest(
      request.method,
      `${url.protocol}//${url.host}${url.pathname}`,
      normalizeHeaders(request.getHeaders()),
    );

    request.on("response", (response) => {
      response.once("end", () => {
        if (!recording.running) {
          warnRecordingNotRunning(url);
          return;
        }

        handleClientResponse(clientRequestEvent, startTime, response);
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

function handleClientResponse(
  requestEvent: AppMap.HttpClientRequestEvent,
  startTime: number,
  response: http.IncomingMessage,
): void {
  assert(response.statusCode != undefined);
  recording.httpClientResponse(
    requestEvent.id,
    getTime() - startTime,
    response.statusCode,
    normalizeHeaders(response.headers),
  );
}

let remoteRunning = false;

function handleRequest(request: http.IncomingMessage, response: http.ServerResponse) {
  if (!(request.method && request.url)) return;
  const url = new URL(request.url, "http://example");
  const timestamp = remoteRunning ? undefined : startRequestRecording(url.pathname);
  const requestEvent = recording.httpRequest(
    request.method,
    url.pathname,
    `HTTP/${request.httpVersion}`,
    normalizeHeaders(request.headers),
    url.searchParams,
  );
  const startTime = getTime();
  response.once("finish", () => {
    handleResponse(request, requestEvent, startTime, timestamp, response);
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

function handleResponse(
  request: http.IncomingMessage,
  requestEvent: AppMap.HttpServerRequestEvent,
  startTime: number,
  timestamp: string | undefined,
  response: http.ServerResponse<http.IncomingMessage>,
): void {
  if (fixupEvent(request, requestEvent)) recording.fixup(requestEvent);
  recording.httpResponse(
    requestEvent.id,
    getTime() - startTime,
    response.statusCode,
    normalizeHeaders(response.getHeaders()),
  );
  if (remoteRunning) return;
  const { request_method, path_info } = requestEvent.http_server_request;
  recording.metadata.name = `${request_method} ${path_info} (${response.statusCode}) — ${timestamp}`;
  recording.finish();
  info("Wrote %s", recording.path);
  start(); // just so there's always a recording running
}

function startRequestRecording(pathname: string): string {
  recording.abandon();
  const timestamp = new Date().toISOString();
  start(new Recording("requests", "requests", [timestamp, pathname].join(" ")));
  return timestamp;
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
        info("Remote recording started");
        recording.abandon();
        start(new Recording("remote", "remote", new Date().toISOString()));
      }
      break;
    case "DELETE":
      if (remoteRunning) {
        remoteRunning = false;
        if (recording.finish()) {
          res.writeHead(200);
          const { path } = recording;
          res.end(readFileSync(path));
          rmSync(path);
        } else res.writeHead(200).end("{}");
        info("Remote recording finished");
        start(); // just so there's always a recording running
      } else res.writeHead(404).end("No recording is in progress");
      break;
    default:
      res.statusCode = 405;
      res.end("Method Not Allowed");
  }
}
