import { Request, Response } from 'express'
import prisma from '../utils/prisma'
import { getCache, setCache, invalidateCache } from '../utils/redis'

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

    // invalidate stock cache
    await invalidateCache('stock:levels')

    // high stock alert
    const { quantity: newQty, high_stock_threshold } = result.stockLevel
    const isHighStock = newQty >= high_stock_threshold

    let high_stock_alert = false
    if (isHighStock) {
      const alertKey = `alert:stock:${product_id}`
      const alreadyAlerted = await getCache<boolean>(alertKey)

      if (!alreadyAlerted) {
        await setCache(alertKey, true, 86400) // suppress for 24 hours
        high_stock_alert = true
        console.log(
          `[HIGH STOCK] Product ${product_id} is at ${newQty} units (threshold: ${high_stock_threshold})`
        )
      }
    }

    res.status(201).json({
      ...result,
      high_stock_alert,
    })
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

      if (!currentLevel) {
        throw new Error('NO_STOCK_LEVEL')
      }
      if (currentLevel.quantity < quantity) {
        throw new Error('INSUFFICIENT_STOCK')
      }

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

    // invalidate stock cache
    await invalidateCache('stock:levels')

    const isLowStock = result.stockLevel.quantity <= result.stockLevel.low_stock_threshold
    if (isLowStock) {
      console.log(
        `[LOW STOCK] Product ${product_id} is at ${result.stockLevel.quantity} units (threshold: ${result.stockLevel.low_stock_threshold})`
      )
    }

    // clear high stock alert so it can re-trigger on next stockIn
    const { quantity: newQty, high_stock_threshold } = result.stockLevel
    if (newQty < high_stock_threshold) {
      await invalidateCache(`alert:stock:${product_id}`)
    }

    res.status(201).json({
      ...result,
      low_stock_warning: isLowStock,
    })
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

    const where: any = {
      product: { status: 'ACTIVE' },
    }

    if (low_stock === 'true') {
      where.quantity = { lte: prisma.stockLevel.fields.low_stock_threshold }
    }

    const levels = await prisma.stockLevel.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, status: true } },
      },
      orderBy: { product: { name: 'asc' } },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    })

    res.json(levels)
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