import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER'] as const

const PERMISSIONS = [
  'product:create', 'product:read', 'product:update', 'product:delete',
  'category:manage', 'supplier:manage',
  'stock:adjust', 'stock:read',
  'order:create', 'order:read', 'order:refund', 'order:cancel',
  'report:read', 'report:generate',
  'user:manage', 'role:manage',
] as const

// Adjust this matrix to match your CEO's actual permission matrix doc.
const ROLE_PERMISSIONS: Record<typeof ROLES[number], string[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  ADMIN: [
    'product:create', 'product:read', 'product:update', 'product:delete',
    'category:manage', 'supplier:manage',
    'stock:adjust', 'stock:read',
    'order:create', 'order:read', 'order:refund', 'order:cancel',
    'report:read', 'report:generate',
    'user:manage',
  ],
  MANAGER: [
    'product:read', 'product:update',
    'stock:adjust', 'stock:read',
    'order:create', 'order:read', 'order:refund',
    'report:read',
  ],
  CASHIER: [
    'product:read',
    'stock:read',
    'order:create', 'order:read',
  ],
}

async function seedRolesAndPermissions() {
  const permissionRecords = await Promise.all(
    PERMISSIONS.map((name) =>
      prisma.permission.upsert({
        where: { permission_name: name },
        update: {},
        create: { permission_name: name },
      })
    )
  )
  const permissionByName = new Map(permissionRecords.map((p) => [p.permission_name, p.id]))

  const roleRecords = await Promise.all(
    ROLES.map((name) =>
      prisma.role.upsert({
        where: { role_name: name },
        update: {},
        create: { role_name: name },
      })
    )
  )
  const roleByName = new Map(roleRecords.map((r) => [r.role_name, r.id]))

  for (const roleName of ROLES) {
    const roleId = roleByName.get(roleName)!
    for (const permName of ROLE_PERMISSIONS[roleName]) {
      const permissionId = permissionByName.get(permName)!
      await prisma.rolePermission.upsert({
        where: { role_id_permission_id: { role_id: roleId, permission_id: permissionId } },
        update: {},
        create: { role_id: roleId, permission_id: permissionId },
      })
    }
  }

  console.log('✅ Roles + Permissions seeded')
  return roleByName
}

async function main() {
  const roleByName = await seedRolesAndPermissions()

  // ─── Super Admin ───────────────────────────────────
  const hash = await bcrypt.hash('Admin@1234', 12)
  await prisma.user.upsert({
    where: { email: 'admin@agora.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@agora.com',
      password_hash: hash,
      role_id: roleByName.get('SUPER_ADMIN')!,
    },
  })
  console.log('✅ Super Admin seeded')

  // ─── Admin ─────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@1234', 12)
  await prisma.user.upsert({
    where: { email: 'admin2@agora.com' },
    update: {},
    create: {
      name: 'Store Admin',
      email: 'admin2@agora.com',
      password_hash: adminHash,
      role_id: roleByName.get('ADMIN')!,
    },
  })

  // ─── Manager ───────────────────────────────────────
  const managerHash = await bcrypt.hash('Manager@1234', 12)
  await prisma.user.upsert({
    where: { email: 'manager@agora.com' },
    update: {},
    create: {
      name: 'Store Manager',
      email: 'manager@agora.com',
      password_hash: managerHash,
      role_id: roleByName.get('MANAGER')!,
    },
  })

  // ─── Cashier ───────────────────────────────────────
  const cashierHash = await bcrypt.hash('Cashier@1234', 12)
  await prisma.user.upsert({
    where: { email: 'cashier@agora.com' },
    update: {},
    create: {
      name: 'Store Cashier',
      email: 'cashier@agora.com',
      password_hash: cashierHash,
      role_id: roleByName.get('CASHIER')!,
    },
  })
  console.log('✅ Admin, Manager, Cashier seeded')

  // ─── Categories ────────────────────────────────────
  const categoryNames = ['Beverages', 'Snacks', 'Dairy', 'Cleaning Supplies', 'Electronics']
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
  console.log('✅ Categories seeded')

  // ─── Suppliers ─────────────────────────────────────
  const suppliers = [
    { name: 'ABC Trading Co.',     contact_name: 'Maria Santos', email: 'maria@abctrading.com', phone: '0917-123-4567', address: 'Quezon City, Philippines' },
    { name: 'Global Foods Inc.',   contact_name: 'John Reyes',   email: 'john@globalfoods.com', phone: '0918-765-4321', address: 'Makati City, Philippines' },
    { name: 'Sunrise Distributors',contact_name: 'Anna Cruz',    email: 'anna@sunrisedist.com', phone: '0919-555-0192', address: 'Pasig City, Philippines' },
  ]
  for (const supplier of suppliers) {
    const existing = await prisma.supplier.findFirst({ where: { name: supplier.name } })
    if (!existing) await prisma.supplier.create({ data: supplier })
  }
  console.log('✅ Suppliers seeded')

  // ─── Products + Stock Levels ───────────────────────
  const beverages  = await prisma.category.findUnique({ where: { name: 'Beverages' } })
  const snacks     = await prisma.category.findUnique({ where: { name: 'Snacks' } })
  const dairy      = await prisma.category.findUnique({ where: { name: 'Dairy' } })
  const cleaning   = await prisma.category.findUnique({ where: { name: 'Cleaning Supplies' } })
  const electronics = await prisma.category.findUnique({ where: { name: 'Electronics' } })

  const abcTrading = await prisma.supplier.findFirst({ where: { name: 'ABC Trading Co.' } })
  const globalFoods = await prisma.supplier.findFirst({ where: { name: 'Global Foods Inc.' } })
  const sunrise    = await prisma.supplier.findFirst({ where: { name: 'Sunrise Distributors' } })

  const products = [
    // Beverages
    { name: 'Coca-Cola 1.5L',      sku: 'BEV-001', price: 65.00,  category_id: beverages!.id,  supplier_id: globalFoods!.id, qty: 100, threshold: 20 },
    { name: 'Royal TRU Orange 1L', sku: 'BEV-002', price: 45.00,  category_id: beverages!.id,  supplier_id: globalFoods!.id, qty: 80,  threshold: 15 },
    { name: 'Mineral Water 500ml', sku: 'BEV-003', price: 15.00,  category_id: beverages!.id,  supplier_id: abcTrading!.id,  qty: 200, threshold: 50 },
    // Snacks
    { name: 'Chippy BBQ 110g',     sku: 'SNK-001', price: 18.00,  category_id: snacks!.id,     supplier_id: abcTrading!.id,  qty: 150, threshold: 30 },
    { name: 'Nova Country Cheddar',sku: 'SNK-002', price: 22.00,  category_id: snacks!.id,     supplier_id: abcTrading!.id,  qty: 120, threshold: 25 },
    { name: 'Skyflakes Crackers',  sku: 'SNK-003', price: 12.00,  category_id: snacks!.id,     supplier_id: globalFoods!.id, qty: 90,  threshold: 20 },
    // Dairy
    { name: 'Bear Brand 300g',     sku: 'DAI-001', price: 89.00,  category_id: dairy!.id,      supplier_id: globalFoods!.id, qty: 60,  threshold: 10 },
    { name: 'Magnolia Full Cream', sku: 'DAI-002', price: 75.00,  category_id: dairy!.id,      supplier_id: sunrise!.id,     qty: 40,  threshold: 10 },
    // Cleaning
    { name: 'Tide Powder 1kg',     sku: 'CLE-001', price: 89.00,  category_id: cleaning!.id,   supplier_id: sunrise!.id,     qty: 50,  threshold: 10 },
    { name: 'Joy Dishwashing 500ml',sku:'CLE-002', price: 49.00,  category_id: cleaning!.id,   supplier_id: sunrise!.id,     qty: 70,  threshold: 15 },
    // Electronics
    { name: 'AA Batteries 2pc',    sku: 'ELE-001', price: 45.00,  category_id: electronics!.id,supplier_id: abcTrading!.id,  qty: 200, threshold: 40 },
    { name: 'USB-C Cable 1m',      sku: 'ELE-002', price: 199.00, category_id: electronics!.id,supplier_id: abcTrading!.id,  qty: 30,  threshold: 5  },
  ]

  for (const p of products) {
    const { qty, threshold, ...productData } = p

    const product = await prisma.product.upsert({
      where: { sku: productData.sku },
      update: {},
      create: { ...productData, price: productData.price },
    })

    await prisma.stockLevel.upsert({
      where:  { product_id: product.id },
      update: {
        quantity:             qty,
        low_stock_threshold:  threshold,
        high_stock_threshold: threshold * 5,
      },
      create: {
        product_id:           product.id,
        quantity:             qty,
        low_stock_threshold:  threshold,
        high_stock_threshold: threshold * 5,
      },
    })
  }
  console.log('✅ Products + Stock Levels seeded')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())