import {
  MAX_ARRAY_ELEMENTS,
  MAX_DEPTH,
  formatCollection,
  formatMongoStatement,
  shape,
} from "../mongoQuery";

class FakeObjectId {
  constructor(public readonly hex = "507f1f77bcf86cd799439011") {}
}

describe(formatCollection, () => {
  it("uses shell dot syntax for identifier-like names", () => {
    expect(formatCollection("users")).toBe("db.users");
    expect(formatCollection("users.archive")).toBe("db.users.archive");
    expect(formatCollection("_tmp$1")).toBe("db._tmp$1");
  });

  it("falls back to getCollection for other names", () => {
    expect(formatCollection("my-coll")).toBe('db.getCollection("my-coll")');
    expect(formatCollection("with space")).toBe('db.getCollection("with space")');
    expect(formatCollection("")).toBe('db.getCollection("")');
    expect(formatCollection('q"uote')).toBe('db.getCollection("q\\"uote")');
    expect(formatCollection("a..b")).toBe('db.getCollection("a..b")');
  });
});

describe(shape, () => {
  it("keeps keys and replaces leaves", () => {
    expect(shape({ a: 1, b: "x", c: null, d: undefined, e: true })).toBe(
      '{"a": ?, "b": ?, "c": ?, "d": ?, "e": ?}',
    );
  });

  it("keeps key order and nesting", () => {
    expect(shape({ z: { y: { x: 1 } }, a: 2 })).toBe('{"z": {"y": {"x": ?}}, "a": ?}');
  });

  it("keeps operators, since they are keys", () => {
    expect(shape({ age: { $gt: 18, $lt: 65 }, $or: [{ a: 1 }, { b: 2 }] })).toBe(
      '{"age": {"$gt": ?, "$lt": ?}, "$or": [{"a": ?}, {"b": ?}]}',
    );
  });

  it("collapses arrays to their distinct element shapes", () => {
    expect(shape({ $in: [1, 2, 3] })).toBe('{"$in": [?]}');
    expect(shape([{ a: 1 }, { a: 2 }, { b: 3 }, { a: 4 }])).toBe('[{"a": ?}, {"b": ?}]');
    expect(shape([])).toBe("[]");
    expect(shape({})).toBe("{}");
  });

  it("keeps every element of an ordered array", () => {
    expect(shape([{ $unwind: "$a" }, { $unwind: "$b" }], true)).toBe(
      '[{"$unwind": ?}, {"$unwind": ?}]',
    );
    // only the top level is ordered; nested arrays are still collapsed
    expect(shape([{ $match: { a: { $in: [1, 2] } } }], true)).toBe(
      '[{"$match": {"a": {"$in": [?]}}}]',
    );
  });

  it("treats class instances and BSON-like values as leaves", () => {
    expect(
      shape({
        _id: new FakeObjectId(),
        at: new Date(),
        re: /abc/,
        buf: Buffer.from("x"),
        fn: () => 1,
        big: 10n,
        sym: Symbol("s"),
      }),
    ).toBe('{"_id": ?, "at": ?, "re": ?, "buf": ?, "fn": ?, "big": ?, "sym": ?}');
  });

  it("treats Maps as documents", () => {
    expect(
      shape(
        new Map<unknown, unknown>([
          ["a", 1],
          [2, { b: 3 }],
        ]),
      ),
    ).toBe('{"a": ?, "2": {"b": ?}}');
  });

  it("handles objects without a prototype", () => {
    const doc = Object.create(null) as Record<string, unknown>;
    doc.a = 1;
    expect(shape(doc)).toBe('{"a": ?}');
  });

  it("escapes keys", () => {
    expect(shape({ 'he said "hi"': 1, "a.b": 2, "": 3, "\n": 4 })).toBe(
      '{"he said \\"hi\\"": ?, "a.b": ?, "": ?, "\\n": ?}',
    );
  });

  it("does not recurse into cycles", () => {
    const doc: Record<string, unknown> = { a: 1 };
    doc.self = doc;
    const arr: unknown[] = [1];
    arr.push(arr);
    doc.arr = arr;
    expect(shape(doc)).toBe('{"a": ?, "self": ?, "arr": [?]}');
  });

  it("allows the same object in two places", () => {
    const inner = { x: 1 };
    expect(shape({ a: inner, b: inner })).toBe('{"a": {"x": ?}, "b": {"x": ?}}');
  });

  it("stops at the depth limit", () => {
    let doc: unknown = 1;
    for (let i = 0; i < MAX_DEPTH + 5; i++) doc = { n: doc };
    const rendered = shape(doc);
    expect(rendered.endsWith('"n": ?' + "}".repeat(MAX_DEPTH + 1))).toBe(true);
    expect(rendered.startsWith('{"n": '.repeat(MAX_DEPTH + 1))).toBe(true);
  });

  it("examines at most MAX_ARRAY_ELEMENTS elements", () => {
    const arr = new Array<unknown>(MAX_ARRAY_ELEMENTS).fill({ a: 1 });
    arr.push({ b: 2 });
    expect(shape(arr)).toBe('[{"a": ?}]');
  });

  it("ignores symbol keys and inherited properties", () => {
    const doc = { a: 1, [Symbol("s")]: 2 };
    expect(shape(doc)).toBe('{"a": ?}');
  });
});

describe(formatMongoStatement, () => {
  it("renders documents, updates and options", () => {
    expect(
      formatMongoStatement(
        "users",
        "updateOne",
        ["filter", "update", "options"],
        [{ _id: new FakeObjectId() }, { $set: { name: "x" }, $inc: { n: 1 } }, { upsert: true }],
      ),
    ).toBe(
      'db.users.updateOne({"_id": ?}, {"$set": {"name": ?}, "$inc": {"n": ?}}, {"upsert": ?})',
    );
  });

  it("omits trailing undefined arguments", () => {
    expect(formatMongoStatement("users", "find", ["filter", "options"], [])).toBe(
      "db.users.find()",
    );
    expect(formatMongoStatement("users", "find", ["filter", "options"], [{}, undefined])).toBe(
      "db.users.find({})",
    );
    expect(
      formatMongoStatement("users", "find", ["filter", "options"], [undefined, { limit: 1 }]),
    ).toBe('db.users.find(?, {"limit": ?})');
  });

  it("ignores arguments beyond the declared parameters", () => {
    expect(formatMongoStatement("users", "drop", ["options"], [{}, "extra", 1])).toBe(
      "db.users.drop({})",
    );
  });

  it("keeps aggregation pipelines in order", () => {
    expect(
      formatMongoStatement(
        "orders",
        "aggregate",
        ["pipeline", "options"],
        [
          [
            { $match: { status: "A" } },
            { $unwind: "$items" },
            { $unwind: "$items.parts" },
            { $group: { _id: "$cust", total: { $sum: "$amount" } } },
          ],
        ],
      ),
    ).toBe(
      'db.orders.aggregate([{"$match": {"status": ?}}, {"$unwind": ?}, {"$unwind": ?}, {"$group": {"_id": ?, "total": {"$sum": ?}}}])',
    );
  });

  it("keeps update pipelines in order", () => {
    expect(
      formatMongoStatement(
        "users",
        "updateMany",
        ["filter", "update", "options"],
        [{}, [{ $set: { a: 1 } }, { $set: { b: 2 } }]],
      ),
    ).toBe('db.users.updateMany({}, [{"$set": {"a": ?}}, {"$set": {"b": ?}}])');
  });

  it("collapses lists of documents and operations", () => {
    expect(
      formatMongoStatement("users", "insertMany", ["docs", "options"], [[{ a: 1 }, { a: 2 }]]),
    ).toBe('db.users.insertMany([{"a": ?}])');
    expect(
      formatMongoStatement(
        "users",
        "bulkWrite",
        ["operations", "options"],
        [
          [
            { insertOne: { document: { a: 1 } } },
            { insertOne: { document: { a: 2 } } },
            { updateOne: { filter: { a: 1 }, update: { $set: { b: 1 } } } },
          ],
        ],
      ),
    ).toBe(
      'db.users.bulkWrite([{"insertOne": {"document": {"a": ?}}}, {"updateOne": {"filter": {"a": ?}, "update": {"$set": {"b": ?}}}}])',
    );
  });

  it("keeps names verbatim", () => {
    expect(
      formatMongoStatement("users", "distinct", ["key", "filter", "options"], ["email", { a: 1 }]),
    ).toBe('db.users.distinct("email", {"a": ?})');
    expect(formatMongoStatement("users", "rename", ["newName", "options"], ["people"])).toBe(
      'db.users.rename("people")',
    );
    expect(formatMongoStatement("users", "dropIndex", ["indexName", "options"], ["a_1"])).toBe(
      'db.users.dropIndex("a_1")',
    );
    expect(
      formatMongoStatement("users", "indexExists", ["indexes", "options"], [["a_1", "b_1"]]),
    ).toBe('db.users.indexExists(["a_1", "b_1"])');
    // a name argument that is not a string is rendered as a shape
    expect(formatMongoStatement("users", "dropIndex", ["indexName", "options"], [{ a: 1 }])).toBe(
      'db.users.dropIndex({"a": ?})',
    );
    expect(formatMongoStatement("users", "distinct", ["key", "filter"], [["a", 1]])).toBe(
      "db.users.distinct([?])",
    );
  });

  it("renders index specs as documents", () => {
    expect(
      formatMongoStatement(
        "users",
        "createIndex",
        ["indexSpec", "options"],
        [{ email: 1 }, { unique: true, name: "email_idx" }],
      ),
    ).toBe('db.users.createIndex({"email": ?}, {"unique": ?, "name": ?})');
  });

  it("never throws on hostile arguments", () => {
    const hostile = {
      get a(): number {
        throw new Error("boom");
      },
    };
    expect(formatMongoStatement("users", "find", ["filter"], [hostile])).toBe("db.users.find(?)");
  });
});
