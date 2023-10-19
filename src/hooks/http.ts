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
