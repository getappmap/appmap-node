import { inspect } from "node:util";

import type mongodb from "mongodb";

import { identifier } from "../generate";
import { fixReturnEventsIfPromiseResult, getActiveRecordings, isActive } from "../recorder";
import { FunctionInfo } from "../registry";
import { getTime } from "../util/getTime";
import { setCustomInspect } from "../parameter";

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
    if (callback) {
      const functionCallArgs = args.map((x) => setCustomInspect(x, customInspect));
      const callEvents = recordings.map((recording) =>
        recording.functionCall(funInfo, this, functionCallArgs),
      );

      const startTime = getTime();
      args.push((err: unknown, res: unknown) => {
        setCustomInspect(res, customInspect);

        if (err)
          recordings.forEach(
            (recording, idx) =>
              isActive(recording) && recording.functionException(callEvents[idx].id, err, startTime),
          );
        else
          recordings.forEach(
            (recording, idx) =>
              isActive(recording) && recording.functionReturn(callEvents[idx].id, res, startTime),
          );

        return callback(err, res) as unknown;
      });
      return Reflect.apply(original, this, args) as ReturnType<typeof original>;
    }

    const callEvents = recordings.map((recording) => recording.functionCall(funInfo, this, args));
    const startTime = getTime();

    try {
      const result = Reflect.apply(original, this, args) as unknown;
      setCustomInspect(result, customInspect);

      const returnEvents = recordings.map((recording, idx) =>
        recording.functionReturn(callEvents[idx].id, result, startTime),
      );
      return fixReturnEventsIfPromiseResult(
        recordings,
        result,
        returnEvents,
        callEvents,
        startTime,
      ) as ReturnType<typeof original>;
    } catch (exn: unknown) {
      const elapsed = getTime() - startTime;
      recordings.map((recording, idx) =>
        recording.functionException(callEvents[idx].id, exn, startTime),
      );
      throw exn;
    }
  };

  markPatched(patched);

  obj[methodName] = patched as typeof original;
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
