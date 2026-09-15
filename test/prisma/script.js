const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Create an extended client and make a call with it first
  // in order to ensure $on(query) hook is registered correctly
  // even with extended clients.
  const extendedPrisma = prisma.$extends({
    query: {
      user: {
        async findMany({ args, query }) {
          args.where = { ...args.where, email: { contains: "appmap.io" } };
          return query(args);
        },
      },
    },
  });
  await extendedPrisma.user.findMany({ where: { name: { contains: "Admin" } } });

  await prisma.post.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$executeRaw`delete from sqlite_sequence where name='Post'`;
  await prisma.$executeRaw`delete from sqlite_sequence where name='User'`;

  const alice = await prisma.user.create({
    data: {
      name: "Alice",
      email: "alice@prisma.io",
    },
  });

  console.log(alice);

  const bob = await prisma.user.create({
    data: {
      name: "Bob",
      email: "bob@prisma.io",
      posts: {
        create: {
          title: "Hello World",
        },
      },
    },
  });

  console.log(bob);

  // A query the application catches must not escape as an unhandled rejection.
  // The email is unique, so this create fails with P2002.
  try {
    await prisma.user.create({
      data: {
        name: "Alice again",
        email: "alice@prisma.io",
      },
    });
  } catch (error) {
    console.log("caught:", error.code);
  }

  const bobsWithPosts = await prisma.user.findMany({
    include: {
      posts: true,
    },
    where: {
      name: {
        contains: "Bob",
      },
    },
  });
  console.log(bobsWithPosts);

  await prisma.$queryRaw`SELECT 1`;
}

main();
