// eslint-disable-next-line @typescript-eslint/no-var-requires
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
