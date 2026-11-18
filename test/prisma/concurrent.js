const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  for (let i = 0; i < 5; i++) {
    await Promise.all([
      prisma.user.findMany({ where: { name: { contains: "Alice" } } }),
      prisma.post.findMany({ where: { published: false } }),
      prisma.user.count(),
    ]);
  }

  // An interactive transaction runs BEGIN and COMMIT outside of any call.
  await Promise.all([
    prisma.post.findMany(),
    prisma.$transaction(async (tx) => {
      await tx.user.findMany();
    }),
  ]);

  await prisma.post.count();
}

main().finally(() => prisma.$disconnect());
