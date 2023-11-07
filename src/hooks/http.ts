import assert from "node:assert";
import { ClientRequest } from "node:http";
import type http from "node:http";
import type https from "node:https";

import type AppMap from "../AppMap";
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

function handleClientRequest(request: http.ClientRequest) {
  // for some reason proxy construct/apply is called multiple times for the same request
  // so let's make sure we haven't seen this one before
  if (clientRequests.has(request)) return;
  clientRequests.add(request);

  const startTime = getTime();
  request.on("finish", () => {
    const url = new URL(`${request.protocol}//${request.host}${request.path}`);
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
  requests.add(request);
  if (!(request.method && request.url)) return;
  const requestEvent = recording.httpRequest(
    request.method,
    request.url,
    `HTTP/${request.httpVersion}`,
    normalizeHeaders(request.headers),
  );
  const startTime = getTime();
  response.once("finish", () => handleResponse(requestEvent, startTime, response));
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
