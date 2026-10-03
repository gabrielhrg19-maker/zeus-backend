import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const users = await prisma.user.findMany()
  for (const user of users) {
    const cleanRole = user.role.trim().toUpperCase()
    if (cleanRole !== user.role) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: cleanRole }
      })
      console.log(`Updated user ${user.email}: ${user.role} -> ${cleanRole}`)
    }
  }
}
main()
