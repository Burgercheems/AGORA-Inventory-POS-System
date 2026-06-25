import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.$queryRawUnsafe<any[]>(`
    SELECT u.id, u.email, u.role_id, r.role_name
    FROM "User" u
    LEFT JOIN "Role" r ON r.id = u.role_id;
  `)
  console.log(JSON.stringify(users, null, 2))
}

main().finally(() => prisma.$disconnect())