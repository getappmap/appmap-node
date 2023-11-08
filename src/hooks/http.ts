import type http from "node:http";
import type https from "node:https";
import { URL } from "node:url";

import type AppMap from "../AppMap";
import { parameter } from "../parameter";
import { recording } from "../recorder";
import { getTime } from "../util/getTime";

type HTTP = typeof http | typeof https;

export default function httpHook(mod: HTTP) {
  mod.createServer = new Proxy(mod.createServer, {
    apply(target, thisArg, argArray: Parameters<typeof mod.createServer>) {
      return target.apply(thisArg, argArray).prependListener("request", handleRequest);
    },
  });
  return mod;
}

httpHook.applicable = function (id: string) {
  return ["http", "https", "node:http", "node:https"].includes(id);
};

const requests = new WeakSet<http.IncomingMessage>();

function handleRequest(request: http.IncomingMessage, response: http.ServerResponse) {
  // for some reason this event is emitted multiple times for the same request
  // so let's make sure we haven't seen this one before
  if (requests.has(request)) return;
  if (!(request.method && request.url)) return;
  const url = new URL(request.url, "http://example");
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
    if (fixupEvent(request, requestEvent)) recording.fixup(requestEvent);
    handleResponse(requestEvent, startTime, response);
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

  for (const [k, v] of Object.entries(headers))
    if (v === undefined) continue;
    else if (v instanceof Array) result[k] = v.join("\n");
    else result[k] = String(v);

  return result;
}

function handleResponse(
  requestEvent: AppMap.HttpServerRequestEvent,
  startTime: number,
  response: http.ServerResponse<http.IncomingMessage>,
): void {
  recording.httpResponse(
    requestEvent.id,
    getTime() - startTime,
    response.statusCode,
    normalizeHeaders(response.getHeaders()),
  );
}
