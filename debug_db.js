const{PrismaClient}=require('@prisma/client');
const p=new PrismaClient();

async function main() {
  // Delete all existing athlete records so we can test fresh
  const deleted = await p.stageLog.deleteMany({});
  console.log("Deleted stage logs:", deleted.count);
  
  const deletedAthletes = await p.athlete.deleteMany({});
  console.log("Deleted athletes:", deletedAthletes.count);
  
  console.log("Done! Athletes cleared for fresh test.");
  
  // Show remaining orders
  const orders = await p.order.findMany({
    where: { type: 'COMPETITOR', paymentStatus: 'APPROVED' },
    include: { user: true }
  });
  console.log("\n=== APPROVED COMPETITOR ORDERS ===");
  orders.forEach(o => {
    console.log(o.id.substring(0,8), "|", o.user.name, "| cats:", JSON.stringify(o.categoryIds));
  });

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
