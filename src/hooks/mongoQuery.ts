// Renders a MongoDB collection operation as a query statement with a
// normalized argument shape, so that it can be recorded as a sql_query event
// (database_type "mongodb") and compared across recordings the way SQL is.
//
// The same rules are implemented by the Java agent
// (com.appland.appmap.process.hooks.MongoQueryShape). Keep them in sync.
//
// Statement form:
//
//   db.<collection>.<method>(<arg>, <arg>, ...)
//
// - The collection is written `db.name` when the name is a plain identifier
//   path, and `db.getCollection("name")` otherwise.
// - Arguments are rendered in the order of the driver method's parameters.
//   Trailing undefined arguments are omitted.
// - Documents (filters, updates, replacements, inserted documents, index
//   specs, options) keep their keys, in order, and every leaf value becomes
//   `?`. Keys are written as JSON strings.
// - Arrays inside documents, and top-level lists of documents (insertMany,
//   bulkWrite, createIndexes), keep only the distinct element shapes, in order
//   of first appearance. `{"$in": [1, 2, 3]}` becomes `{"$in": [?]}`, and a
//   thousand inserted documents of the same shape become one.
// - Aggregation pipelines (aggregate, watch, and update pipelines) keep every
//   stage in order, because stage order and repetition are part of the query.
// - Name-like arguments (a distinct field, an index name, a new collection
//   name) are kept verbatim as JSON strings; they identify the query the same
//   way a table or column name does.
// - Everything that is not a plain object, Map or array (BSON types such as
//   ObjectId, Date, Decimal128 and Binary, class instances, functions,
//   primitives, null and undefined) is a leaf and becomes `?`.
// - Nesting deeper than MAX_DEPTH, and cyclic references, become `?`. Only the
//   first MAX_ARRAY_ELEMENTS elements of an array are examined.

export const DATABASE_TYPE = "mongodb";

export const MAX_DEPTH = 32;
export const MAX_ARRAY_ELEMENTS = 1000;

const PLACEHOLDER = "?";

type ArgKind = "document" | "pipeline" | "name" | "options";

// How each named argument of a Collection method is rendered. Names come from
// the method table in ./mongo.ts.
const ARG_KINDS: Record<string, ArgKind> = {
  doc: "document",
  docs: "document",
  filter: "document",
  update: "document",
  replacement: "document",
  operations: "document",
  indexSpec: "document",
  indexSpecs: "document",
  pipeline: "pipeline",
  key: "name",
  newName: "name",
  indexName: "name",
  indexes: "name",
  options: "options",
};

/**
 * Formats a collection method call as a normalized statement.
 * Never throws: if the arguments cannot be inspected the statement is
 * rendered with a single `?` in place of the argument list.
 */
export function formatMongoStatement(
  collection: string,
  method: string,
  argNames: readonly string[],
  args: readonly unknown[],
): string {
  const prefix = `${formatCollection(collection)}.${method}`;
  try {
    return `${prefix}(${formatArgs(argNames, args)})`;
  } catch {
    return `${prefix}(${PLACEHOLDER})`;
  }
}

const IDENTIFIER_PATH = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

export function formatCollection(name: string): string {
  if (IDENTIFIER_PATH.test(name)) return `db.${name}`;
  return `db.getCollection(${JSON.stringify(name)})`;
}

function formatArgs(argNames: readonly string[], args: readonly unknown[]): string {
  const count = Math.min(argNames.length, args.length);
  let last = count;
  while (last > 0 && args[last - 1] === undefined) last--;

  const rendered: string[] = [];
  for (let i = 0; i < last; i++) rendered.push(formatArg(argNames[i], args[i]));
  return rendered.join(", ");
}

function formatArg(name: string, value: unknown): string {
  const kind = ARG_KINDS[name] ?? "document";
  switch (kind) {
    case "name":
      if (typeof value === "string") return JSON.stringify(value);
      if (Array.isArray(value) && value.every((v) => typeof v === "string"))
        return `[${value.map((v) => JSON.stringify(v)).join(", ")}]`;
      return shape(value, false);
    case "pipeline":
      return shape(value, true);
    case "document":
      // An update can be a pipeline (an array of stages) instead of a document.
      return shape(value, name === "update" && Array.isArray(value));
    case "options":
      return shape(value, false);
  }
}

/**
 * Renders the shape of a value: keys kept, leaves replaced with `?`.
 * @param ordered when true, a top-level array keeps all of its elements in
 *   order (a pipeline); otherwise distinct element shapes are kept.
 */
export function shape(value: unknown, ordered = false): string {
  return shapeOf(value, ordered, 0, new Set());
}

function shapeOf(value: unknown, ordered: boolean, depth: number, ancestors: Set<object>): string {
  if (depth > MAX_DEPTH) return PLACEHOLDER;

  if (Array.isArray(value)) {
    if (ancestors.has(value)) return PLACEHOLDER;
    ancestors.add(value);
    try {
      return shapeOfArray(value, ordered, depth, ancestors);
    } finally {
      ancestors.delete(value);
    }
  }

  const entries = documentEntries(value);
  if (!entries) return PLACEHOLDER;
  if (ancestors.has(value as object)) return PLACEHOLDER;
  ancestors.add(value as object);
  try {
    const parts: string[] = [];
    for (const [key, val] of entries)
      parts.push(`${JSON.stringify(key)}: ${shapeOf(val, false, depth + 1, ancestors)}`);
    return `{${parts.join(", ")}}`;
  } finally {
    ancestors.delete(value as object);
  }
}

function shapeOfArray(
  value: unknown[],
  ordered: boolean,
  depth: number,
  ancestors: Set<object>,
): string {
  const limit = Math.min(value.length, MAX_ARRAY_ELEMENTS);
  const parts: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < limit; i++) {
    const part = shapeOf(value[i], false, depth + 1, ancestors);
    if (ordered) parts.push(part);
    else if (!seen.has(part)) {
      seen.add(part);
      parts.push(part);
    }
  }
  return `[${parts.join(", ")}]`;
}

// Returns the entries of a document-like value, or undefined for a leaf.
function documentEntries(value: unknown): Iterable<[string, unknown]> | undefined {
  if (value === null || typeof value !== "object") return undefined;
  if (value instanceof Map)
    return [...value.entries()].map(([k, v]): [string, unknown] => [String(k), v]);
  if (!isPlainObject(value)) return undefined;
  return Object.keys(value).map((key): [string, unknown] => [
    key,
    (value as Record<string, unknown>)[key],
  ]);
}

// A document is a plain object: created by a literal, Object.create(null), or
// the Object constructor of another realm. Instances of any other class
// (ObjectId, Date, Buffer, driver sessions, user models) are leaves.
function isPlainObject(value: object): boolean {
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto === null || proto === Object.prototype) return true;
  const ctor: unknown = (proto as { constructor?: unknown }).constructor;
  return (
    typeof ctor === "function" && ctor.name === "Object" && Object.getPrototypeOf(proto) === null
  );
}
