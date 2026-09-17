const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URI);
void work();

async function work() {
  const db = client.db("appmap-node");
  const collection = db.collection("test");
  await collection.drop();

  // make a couple of insertions, finds and updates on db
  await collection.insertOne({ a: 1 });
  await collection.insertOne({ a: 2 });
  await collection.updateOne({ a: 1 }, { $set: { a: 3 } });
  const result = collection.findOne({ a: 3 });
  await result;
  console.log(result); // { a: 3 }
  console.log(await collection.countDocuments());

  // Documents of the same shape collapse to one in the query event.
  await collection.insertMany([
    { a: 4, tags: ["x"] },
    { a: 5, tags: ["y", "z"] },
  ]);

  // A find with an operator and options; the cursor is consumed with toArray.
  console.log(
    await collection
      .find({ a: { $in: [3, 4, 5] } }, { sort: { a: -1 }, projection: { _id: 0 } })
      .toArray(),
  );

  // A pipeline keeps its stages in order.
  console.log(
    await collection
      .aggregate([{ $match: { a: { $gte: 3 } } }, { $group: { _id: null, total: { $sum: "$a" } } }])
      .toArray(),
  );

  // A failed operation is recorded as an exception on the query as well.
  await collection.createIndex({ a: 1 }, { unique: true });
  try {
    await collection.insertOne({ a: 3 });
  } catch (error) {
    console.log("caught:", error.code);
  }

  await collection.deleteMany({ a: { $gte: 4 } });

  await client.close();
}
