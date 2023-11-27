import assert from "node:assert";
import type http from "node:http";
import { ClientRequest } from "node:http";
import type https from "node:https";
import { URL } from "node:url";

import type AppMap from "../AppMap";
import Recording from "../Recording";
import { info } from "../message";
import { parameter } from "../parameter";
import { recording, start } from "../recorder";
import { getTime } from "../util/getTime";

type HTTP = typeof http | typeof https;

export default function httpHook(mod: HTTP) {
  mod.createServer = new Proxy(mod.createServer, {
    apply(target, thisArg, argArray: Parameters<typeof mod.createServer>) {
      return target.apply(thisArg, argArray).prependListener("request", handleRequest);
    },
  });

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

function handleClientRequest(request: http.ClientRequest) {
  // for some reason proxy construct/apply is called multiple times for the same request
  // so let's make sure we haven't seen this one before
  if (clientRequests.has(request)) return;
  clientRequests.add(request);

  const startTime = getTime();
  request.on("finish", () => {
    const url = extractRequestURL(request);
    // Setting port to the default port for the protocol makes it empty string.
    // See: https://nodejs.org/api/url.html#urlport
    url.port = request.socket?.remotePort + "";
    const clientRequestEvent = recording.httpClientRequest(
      request.method,
      `${url.protocol}//${url.host}${url.pathname}`,
      normalizeHeaders(request.getHeaders()),
    );

    request.on("response", (response) => {
      response.once("end", () => handleClientResponse(clientRequestEvent, startTime, response));
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

const requests = new WeakSet<http.IncomingMessage>();

function handleRequest(request: http.IncomingMessage, response: http.ServerResponse) {
  // for some reason this event is emitted multiple times for the same request
  // so let's make sure we haven't seen this one before
  if (requests.has(request)) return;
  if (!(request.method && request.url)) return;
  const url = new URL(request.url, "http://example");
  const timestamp = startRequestRecording(url.pathname);
  const requestEvent = recording.httpRequest(
    request.method,
    url.pathname,
    `HTTP/${request.httpVersion}`,
    normalizeHeaders(request.headers),
    url.searchParams,
  );
  const startTime = getTime();
  requests.add(request);
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
  timestamp: string,
  response: http.ServerResponse<http.IncomingMessage>,
): void {
  if (fixupEvent(request, requestEvent)) recording.fixup(requestEvent);
  recording.httpResponse(
    requestEvent.id,
    getTime() - startTime,
    response.statusCode,
    normalizeHeaders(response.getHeaders()),
  );
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
