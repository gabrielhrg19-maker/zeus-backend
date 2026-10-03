const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const championships = await prisma.championship.findMany({
    select: { id: true, name: true }
  });
  console.log(JSON.stringify(championships, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
