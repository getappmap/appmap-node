import { inspect } from "node:util";

import type mongodb from "mongodb";

import { makeExceptionEvent, makeReturnEvent } from "../event";
import { identifier } from "../generate";
import { getActiveRecordings, isActive } from "../recorder";
import type Recording from "../Recording";
import { FunctionInfo } from "../registry";
import { getTime } from "../util/getTime";
import { setCustomInspect } from "../parameter";
import type * as AppMap from "../AppMap";
import { DATABASE_TYPE, formatMongoStatement } from "./mongoQuery";

export default function mongoHook(mod: typeof mongodb) {
  const collectionMethods: Partial<Record<MethodLikeKeys<mongodb.Collection>, readonly string[]>> =
    {
      insertOne: ["doc", "options"],
      insertMany: ["docs", "options"],
      bulkWrite: ["operations", "options"],
      updateOne: ["filter", "update", "options"],
      replaceOne: ["filter", "replacement", "options"],
      updateMany: ["filter", "update", "options"],
      deleteOne: ["filter", "options"],
      deleteMany: ["filter", "options"],
      rename: ["newName", "options"],
      drop: ["options"],
      findOne: ["filter", "options"],
      find: ["filter", "options"],
      options: ["options"],
      isCapped: ["options"],
      createIndex: ["indexSpec", "options"],
      createIndexes: ["indexSpecs", "options"],
      dropIndex: ["indexName", "options"],
      dropIndexes: ["options"],
      listIndexes: ["options"],
      indexExists: ["indexes", "options"],
      indexInformation: ["options"],
      estimatedDocumentCount: ["options"],
      countDocuments: ["filter", "options"],
      distinct: ["key", "filter", "options"],
      indexes: ["options"],
      findOneAndDelete: ["filter", "options"],
      findOneAndReplace: ["filter", "replacement", "options"],
      findOneAndUpdate: ["filter", "update", "options"],
      aggregate: ["pipeline", "options"],
      watch: ["pipeline", "options"],
      count: ["filter", "options"],
    };
  for (const [method, args] of Object.entries(collectionMethods))
    patchMethod(mod.Collection.prototype, method as MethodLikeKeys<mongodb.Collection>, args);

  setCustomInspect(mod.Collection.prototype, (c) => `[Collection ${c.collectionName}]`);
  setCustomInspect(
    mod.AbstractCursor?.prototype,
    (c) => `[${c.constructor.name} ${c.namespace.toString()}]`,
  );
  return mod;
}

mongoHook.applicable = function (id: string) {
  return id === "mongodb";
};

const funInfos = new Map<string, FunctionInfo>();

// the spec requires every method in the same path to have unique line number
// we're emitting synthetic methods so make sure they all differ
let lineNo = 1;

function functionInfo(name: string, collection: string, argnames: readonly string[]) {
  const key = [collection, name].join(":");
  if (!funInfos.has(key))
    funInfos.set(key, {
      async: true,
      generator: false,
      id: name,
      klassOrFile: collection,
      params: argnames.map(identifier),
      static: false,
      location: { lineno: lineNo++, path: `mongodb/${collection}` },
    });
  return funInfos.get(key)!;
}

// use custom inspect so IDs are rendered properly
const customInspect = (v: unknown) => inspect(v, { customInspect: true });

// Some Collection methods are implemented on top of others (findOne calls
// find). The inner call still gets its function call event, but only the
// outermost operation gets a query event, so one logical operation is one
// query. The driver makes these inner calls synchronously, before the outer
// method returns its promise, so a depth counter is enough.
let operationDepth = 0;

// Each recorded Collection method produces two events: a function call
// (mongodb/<collection>.<method>, with the actual arguments) and, nested under
// it, a sql_query event holding the normalized statement (see ./mongoQuery.ts).
// The query event is what lets Mongo operations appear next to SQL in digests
// and diffs. It is returned as soon as the driver hands back a promise, and
// the return event is fixed up with the real elapsed time (or the rejection)
// when the promise settles.
function patchMethod<K extends MethodLikeKeys<mongodb.Collection>>(
  obj: typeof mongodb.Collection.prototype,
  methodName: K,
  argNames: readonly string[],
) {
  const original = obj[methodName];

  if (isPatched(original)) return;

  const patched = function (
    this: mongodb.Collection,
    ...args: unknown[]
  ): ReturnType<typeof original> {
    const recordings = getActiveRecordings();
    if (!recordings.length)
      return Reflect.apply(original, this, args) as ReturnType<typeof original>;

    const funInfo = functionInfo(methodName, this.collectionName, argNames);
    const callback = extractOptionalCallback(args);
    const nested = operationDepth > 0;
    const statement = nested
      ? undefined
      : formatMongoStatement(this.collectionName, methodName, argNames, args);

    if (callback) {
      const functionCallArgs = args.map((x) => setCustomInspect(x, customInspect));
      const callEvents = recordings.map((recording) =>
        recording.functionCall(funInfo, this, functionCallArgs),
      );
      const queryEvents = queryCallEvents(recordings, statement);

      const startTime = getTime();
      args.push((err: unknown, res: unknown) => {
        setCustomInspect(res, customInspect);

        if (err)
          recordings.forEach((recording, idx) => {
            if (!isActive(recording)) return;
            if (queryEvents) recording.functionException(queryEvents[idx].id, err, startTime);
            recording.functionException(callEvents[idx].id, err, startTime);
          });
        else
          recordings.forEach((recording, idx) => {
            if (!isActive(recording)) return;
            if (queryEvents) recording.functionReturn(queryEvents[idx].id, undefined, startTime);
            recording.functionReturn(callEvents[idx].id, res, startTime);
          });

        return callback(err, res) as unknown;
      });
      operationDepth++;
      try {
        return Reflect.apply(original, this, args) as ReturnType<typeof original>;
      } finally {
        operationDepth--;
      }
    }

    const callEvents = recordings.map((recording) => recording.functionCall(funInfo, this, args));
    const queryEvents = queryCallEvents(recordings, statement);
    const startTime = getTime();

    let result: ReturnType<typeof original>;
    operationDepth++;
    try {
      result = Reflect.apply(original, this, args) as ReturnType<typeof original>;
    } catch (exn: unknown) {
      recordings.forEach((recording, idx) => {
        if (queryEvents) recording.functionException(queryEvents[idx].id, exn, startTime);
        recording.functionException(callEvents[idx].id, exn, startTime);
      });
      throw exn;
    } finally {
      operationDepth--;
    }

    void setCustomInspect(result, customInspect);
    recordings.forEach((recording, idx) => {
      if (queryEvents) {
        const queryReturn = recording.functionReturn(queryEvents[idx].id, undefined, startTime);
        settleQueryReturn(recording, queryReturn, result, startTime);
      }
      recording.functionReturn(callEvents[idx].id, result, startTime);
    });
    return result;
  };

  markPatched(patched);

  obj[methodName] = patched as typeof original;
}

function queryCallEvents(
  recordings: Recording[],
  statement: string | undefined,
): AppMap.SqlQueryEvent[] | undefined {
  if (statement === undefined) return undefined;
  return recordings.map((recording) => recording.sqlQuery(DATABASE_TYPE, statement));
}

// When the operation is asynchronous, the query return event has already been
// emitted with a near-zero elapsed time. Once the promise settles, replace it
// with the real duration, or with an exception event if the query failed.
// Cursors (find, aggregate, listIndexes, watch) are not promises: their query
// is issued lazily, so the return event stays as emitted.
function settleQueryReturn(
  recording: Recording,
  returnEvent: AppMap.FunctionReturnEvent,
  result: unknown,
  startTime: number,
) {
  if (!isPromiseLike(result)) return;
  const parentId = returnEvent.parent_id;
  result.then(
    () =>
      recording.fixup(makeReturnEvent(returnEvent.id, parentId, undefined, getTime() - startTime)),
    (reason: unknown) =>
      recording.fixup(makeExceptionEvent(returnEvent.id, parentId, reason, getTime() - startTime)),
  );
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then: unknown }).then === "function"
  );
}

function extractOptionalCallback(args: unknown[]): FunctionLike | undefined {
  if (typeof args.at(-1) === "function") return args.pop() as FunctionLike;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FunctionLike = (...args: any) => any;

type MethodLikeKeys<T extends object> = keyof {
  [K in keyof T as T[K] extends FunctionLike ? K : never]: T[K];
};

const patchedMarker = Symbol("AppMap-patched");

function markPatched(patched: object) {
  (patched as { [patchedMarker]: boolean })[patchedMarker] = true;
}

function isPatched<T extends object>(original: T): boolean {
  return patchedMarker in original;
}
