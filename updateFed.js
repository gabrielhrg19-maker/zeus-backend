const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const fedAccessToken = "APP_USR-2741922997219398-031321-6ce88bbc92fecc5ae10175b72b0215ee-3266725798";
  const fedWebhookSecret = "734f5f08ed39debd0909eaed00f2f62629c3571eb34441b2b8379959a955e951";
  const fedPublicKey = "APP_USR-7d7c4ad0-fe7d-4636-a0dd-da0536ceb5a5";

  console.log("Updating all championships with new federation credentials...");
  
  const result = await prisma.championship.updateMany({
    data: {
      mpFedAccessToken: fedAccessToken,
      mpFedWebhookSecret: fedWebhookSecret,
      mpFedPublicKey: fedPublicKey
    }
  });

  console.log(`Updated ${result.count} championships.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
