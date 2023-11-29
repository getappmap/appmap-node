import assert from "node:assert";
import { ClientRequest } from "node:http";
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

function hasProtocolHostPath(
  obj: unknown,
): obj is { protocol: string; host: string; path?: string } {
  return (
    obj != undefined &&
    typeof obj === "object" &&
    "protocol" in obj &&
    typeof obj.protocol === "string" &&
    "host" in obj &&
    typeof obj.host === "string" &&
    "path" in obj
  );
}

function handleClientRequest(request: http.ClientRequest) {
  // for some reason proxy construct/apply is called multiple times for the same request
  // so let's make sure we haven't seen this one before
  if (clientRequests.has(request)) return;
  clientRequests.add(request);

  const startTime = getTime();
  request.on("finish", () => {
    // If the http module is mocked with nock library then reqest is an OverridenClientRequest
    // and it does not have protocol and host properties, instead they are in
    // request.options object.
    let urlParts;
    const requestLike: unknown = request;
    if (hasProtocolHostPath(requestLike)) urlParts = requestLike;
    else if (
      requestLike &&
      typeof requestLike === "object" &&
      "options" in requestLike &&
      hasProtocolHostPath(requestLike.options)
    )
      urlParts = requestLike.options;

    let urlString = "unknown";
    if (urlParts) {
      const url = new URL(`${urlParts.protocol}//${urlParts.host}${urlParts.path}`);
      // Setting port to the default port for the protocol makes it empty string.
      // See: https://nodejs.org/api/url.html#urlport
      url.port = request.socket?.remotePort + "";
      urlString = `${url.protocol}//${url.host}${url.pathname}`;
    }

    const clientRequestEvent = recording.httpClientRequest(
      request.method,
      urlString,
      normalizeHeaders(request.getHeaders()),
    );

    request.on("response", (response) => {
      response.once("end", () => handleClientResponse(clientRequestEvent, startTime, response));
    });
  });
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
