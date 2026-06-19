import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Super Admin
  const hash = await bcrypt.hash('Admin@1234', 12)
  await prisma.user.upsert({
    where: { email: 'admin@agora.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@agora.com',
      password_hash: hash,
      role: 'SUPER_ADMIN',
    },
  })
  console.log('Super Admin seeded')

  // Sample categories
  const categories = ['Beverages', 'Snacks', 'Dairy', 'Cleaning Supplies', 'Electronics']
  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
  console.log('Categories seeded')

  // Sample suppliers
  const suppliers = [
    {
      name: 'ABC Trading Co.',
      contact_name: 'Maria Santos',
      email: 'maria@abctrading.com',
      phone: '0917-123-4567',
      address: 'Quezon City, Philippines',
    },
    {
      name: 'Global Foods Inc.',
      contact_name: 'John Reyes',
      email: 'john@globalfoods.com',
      phone: '0918-765-4321',
      address: 'Makati City, Philippines',
    },
    {
      name: 'Sunrise Distributors',
      contact_name: 'Anna Cruz',
      email: 'anna@sunrisedist.com',
      phone: '0919-555-0192',
      address: 'Pasig City, Philippines',
    },
  ]
  for (const supplier of suppliers) {
    const existing = await prisma.supplier.findFirst({ where: { name: supplier.name } })
    if (!existing) {
      await prisma.supplier.create({ data: supplier })
    }
  }
  console.log('Suppliers seeded')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())