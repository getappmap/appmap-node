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

  await client.close();
}
