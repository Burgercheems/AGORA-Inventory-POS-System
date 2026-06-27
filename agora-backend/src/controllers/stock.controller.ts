import { Request, Response } from 'express'
import prisma from '../utils/prisma'
import { getCache, setCache, invalidateCache, invalidateCachePattern } from '../utils/redis'
import { emitStockUpdate, emitLowStockAlert } from '../utils/socketEmitter'

export async function stockIn(req: Request, res: Response) {
  try {
    const { product_id, quantity, reason } = req.body
    const user = (req as any).user

    if (!product_id || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'product_id and a positive quantity are required' })
    }

    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          product_id,
          type: 'STOCK_IN',
          quantity,
          reason,
          user_id: user.userId,
        },
      })

      const stockLevel = await tx.stockLevel.update({
        where: { product_id },
        data: { quantity: { increment: quantity } },
      })

      return { movement, stockLevel }
    })

    await invalidateCachePattern('stock:levels:*')
// get product name for socket event
const product = await prisma.product.findUnique({
  where: { id: product_id },
  select: { name: true },
})
emitStockUpdate(product_id, product?.name ?? product_id, result.stockLevel.quantity)

    const { quantity: newQty, high_stock_threshold } = result.stockLevel
    const isHighStock = newQty >= high_stock_threshold

    let high_stock_alert = false
    if (isHighStock) {
      const alertKey = `alert:stock:${product_id}`
      const alreadyAlerted = await getCache<boolean>(alertKey)

      if (!alreadyAlerted) {
        await setCache(alertKey, true, 86400)
        high_stock_alert = true
        console.log(`[HIGH STOCK] Product ${product_id} is at ${newQty} units (threshold: ${high_stock_threshold})`)
      }
    }

    res.status(201).json({ ...result, high_stock_alert })
  } catch (err) {
    res.status(500).json({ message: 'Failed to record stock in' })
  }
}

export async function stockOut(req: Request, res: Response) {
  try {
    const { product_id, quantity, reason } = req.body
    const user = (req as any).user

    if (!product_id || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'product_id and a positive quantity are required' })
    }

    const result = await prisma.$transaction(async (tx) => {
      const currentLevel = await tx.stockLevel.findUnique({ where: { product_id } })

      if (!currentLevel) throw new Error('NO_STOCK_LEVEL')
      if (currentLevel.quantity < quantity) throw new Error('INSUFFICIENT_STOCK')

      const movement = await tx.stockMovement.create({
        data: {
          product_id,
          type: 'STOCK_OUT',
          quantity,
          reason,
          user_id: user.userId,
        },
      })

      const stockLevel = await tx.stockLevel.update({
        where: { product_id },
        data: { quantity: { decrement: quantity } },
      })

      return { movement, stockLevel }
    })

    await invalidateCachePattern('stock:levels:*')
    const product = await prisma.product.findUnique({
      where: { id: product_id },
      select: { name: true },
    })
    const { quantity: newQty, high_stock_threshold, low_stock_threshold } = result.stockLevel

    emitStockUpdate(product_id, product?.name ?? product_id, newQty)

    const isLowStock = newQty <= low_stock_threshold
    if (isLowStock) {
      emitLowStockAlert(
        product_id,
        product?.name ?? product_id,
        newQty,
        low_stock_threshold
      )
      console.log(`[LOW STOCK] Product ${product_id} is at ${newQty} units (threshold: ${low_stock_threshold})`)
    }

    if (newQty < high_stock_threshold) {
      await invalidateCache(`alert:stock:${product_id}`)
    }

    res.status(201).json({ ...result, low_stock_warning: isLowStock })
  } catch (err: any) {
    if (err.message === 'INSUFFICIENT_STOCK') {
      return res.status(409).json({ message: 'Insufficient stock for this quantity' })
    }
    if (err.message === 'NO_STOCK_LEVEL') {
      return res.status(404).json({ message: 'No stock level found for this product' })
    }
    res.status(500).json({ message: 'Failed to record stock out' })
  }
}

export async function getStockLevels(req: Request, res: Response) {
  try {
    const { page = 1, limit = 50, low_stock } = req.query

    const pageNum = Number(page)
    const limitNum = Number(limit)

    const cacheKey = `stock:levels:page=${pageNum}:limit=${limitNum}:low_stock=${low_stock ?? 'false'}`

    const cached = await getCache<any>(cacheKey)
    if (cached) return res.json(cached)

    const [levels, total] = await Promise.all([
      prisma.stockLevel.findMany({
        where: { product: { status: 'ACTIVE' } },
        include: {
          product: { select: { id: true, name: true, sku: true, status: true } },
        },
        orderBy: { product: { name: 'asc' } },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.stockLevel.count({
        where: { product: { status: 'ACTIVE' } },
      }),
    ])

    const result = low_stock === 'true'
      ? levels.filter((l) => l.quantity <= l.low_stock_threshold)
      : levels

    const response = { data: result, total, page: pageNum, limit: limitNum }

    await setCache(cacheKey, response, 60)

    res.json(response)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch stock levels' })
  }
}

export async function getStockMovements(req: Request, res: Response) {
  try {
    const { product_id, type, page = 1, limit = 20 } = req.query

    const movements = await prisma.stockMovement.findMany({
      where: {
        ...(product_id && { product_id: String(product_id) }),
        ...(type && { type: String(type) as any }),
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        user: { select: { id: true, name: true } },
      },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: { created_at: 'desc' },
    })

    const total = await prisma.stockMovement.count({
      where: {
        ...(product_id && { product_id: String(product_id) }),
        ...(type && { type: String(type) as any }),
      },
    })

    res.json({ data: movements, total, page: Number(page), limit: Number(limit) })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch stock movements' })
  }
}