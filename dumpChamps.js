const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const champs = await prisma.championship.findMany({
    select: {
      id: true,
      name: true,
      mpAccessToken: true,
      mpPublicKey: true,
      mpFedAccessToken: true,
      mpFedPublicKey: true
    }
  });
  console.log(JSON.stringify(champs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
