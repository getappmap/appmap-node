const { PrismaClient } = require("@prisma/client");

// Prisma 7 talks to the database through a driver adapter. We hook better-sqlite3
// but not libsql, so the queries are recorded by the driver hook with the former
// and from Prisma's query events with the latter.
function createAdapter() {
  const url = "file:./test.db";
  if (process.env.ADAPTER == "better-sqlite3") {
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
    return new PrismaBetterSqlite3({ url });
  }
  const { PrismaLibSql } = require("@prisma/adapter-libsql");
  return new PrismaLibSql({ url });
}

// An extension making queries of its own through a driver we hook, on a connection
// of its own, must not stop the client's queries from being recorded, even when it
// makes the same query.
const audit = new (require("better-sqlite3"))(":memory:");
const prisma = new PrismaClient({ adapter: createAdapter() }).$extends({
  query: {
    $queryRaw({ args, query }) {
      audit.prepare("SELECT 1").get();
      return query(args);
    },
  },
});

async function main() {
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$executeRaw`delete from sqlite_sequence`;
  await prisma.$queryRaw`SELECT 1`;

  await prisma.user.create({
    data: {
      name: "Alice",
      email: "alice@prisma.io",
      posts: { create: { title: "Hello World" } },
    },
  });

  // The email is unique, so this create fails with P2002. Prisma reports only the
  // queries which succeed, so its SQL is only recorded by a driver hook.
  try {
    await prisma.user.create({ data: { name: "Alice again", email: "alice@prisma.io" } });
  } catch (error) {
    console.log("caught:", error.code);
  }

  // Each query must be recorded in the call which made it.
  await Promise.all([
    prisma.user.findMany({ where: { name: { contains: "Alice" } } }),
    prisma.post.findMany({ where: { published: false } }),
  ]);

  // Prisma runs these in batches, each in the context of its first request, so
  // which call the queries belong to isn't known.
  await prisma.$transaction([prisma.user.count(), prisma.post.count()]);
  await Promise.all([
    prisma.user.findUnique({ where: { id: 1 } }),
    prisma.post.findUnique({ where: { id: 1 } }),
  ]);
  // A lone findUnique is known to make its own query.
  await prisma.user.findUnique({ where: { id: 1 } });

  await prisma.$transaction(async (tx) => {
    const bob = await tx.user.create({ data: { name: "Bob", email: "bob@prisma.io" } });
    await tx.post.create({ data: { title: "Bob's post", authorId: bob.id } });
  });
}

main().finally(() => prisma.$disconnect());
