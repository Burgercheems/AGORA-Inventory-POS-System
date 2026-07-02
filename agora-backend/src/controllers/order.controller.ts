import { Request, Response } from 'express'
import prisma from '../utils/prisma'
import { calculateDiscount } from '../helpers/order.service'

export async function createOrder(req: Request, res: Response) {
  try {
    const user = (req as any).user
    const { items, discount_type, discount_value, amount_paid, payment_method = 'CASH' } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items array is required' })
    }

    const normalisedDiscountType = discount_type
      ? (String(discount_type).toUpperCase() as 'FLAT' | 'PERCENTAGE')
      : undefined

    const orderId = await prisma.$transaction(
      async (tx) => {
        const productIds = items.map((i: any) => i.product_id)

        // Batch both lookups instead of querying per item in a loop
        const [products, stockLevels] = await Promise.all([
          tx.product.findMany({ where: { id: { in: productIds } } }),
          tx.stockLevel.findMany({ where: { product_id: { in: productIds } } }),
        ])

        const productMap = new Map(products.map((p) => [p.id, p]))
        const stockMap = new Map(stockLevels.map((s) => [s.product_id, s]))

        let subtotal = 0
        const orderItemsData: { product_id: string; quantity: number; unit_price: number }[] = []

        for (const item of items) {
          const product = productMap.get(item.product_id)
          if (!product) throw new Error(`PRODUCT_NOT_FOUND:${item.product_id}`)

          const stockLevel = stockMap.get(item.product_id)
          if (!stockLevel || stockLevel.quantity < item.quantity) {
            throw new Error(`INSUFFICIENT_STOCK:${item.product_id}`)
          }

          const unitPrice = Number(product.price)
          subtotal += unitPrice * item.quantity
          orderItemsData.push({ product_id: item.product_id, quantity: item.quantity, unit_price: unitPrice })
        }

        const discount = calculateDiscount(subtotal, normalisedDiscountType, discount_value)
        const total = subtotal - discount

        const order = await tx.order.create({
          data: {
            cashier_id: user.userId,
            total,
            discount,
            status: 'COMPLETED',
            items: { create: orderItemsData },
          },
        })

        const paid = Number(amount_paid ?? total)
        await tx.transaction.create({
          data: {
            order_id: order.id,
            amount_paid: paid,
            change: paid - total,
            payment_method: String(payment_method).toUpperCase() as any,
            status: 'COMPLETED',
          },
        })

        // Batch-create stock movement records in a single write
        await tx.stockMovement.createMany({
          data: orderItemsData.map((item) => ({
            product_id: item.product_id,
            type: 'STOCK_OUT',
            quantity: item.quantity,
            reason: `Order ${order.id}`,
            user_id: user.userId,
          })),
        })

        // Prisma has no batch "decrement per row" primitive, so this loop stays,
        // but it's now the only remaining per-item loop (down from 3)
        for (const item of orderItemsData) {
          await tx.stockLevel.update({
            where: { product_id: item.product_id },
            data: { quantity: { decrement: item.quantity } },
          })
        }

        return order.id
      },
      { timeout: 15000, maxWait: 5000 } // raised from Prisma's 5000ms default
    )

    const fullOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        cashier: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
        transaction: true,
      },
    })

    res.status(201).json(fullOrder)
  } catch (err: any) {
    if (typeof err.message === 'string' && err.message.startsWith('PRODUCT_NOT_FOUND')) {
      return res.status(404).json({ message: `Product not found: ${err.message.split(':')[1]}` })
    }
    if (typeof err.message === 'string' && err.message.startsWith('INSUFFICIENT_STOCK')) {
      return res.status(409).json({ message: `Insufficient stock for product: ${err.message.split(':')[1]}` })
    }
    if (typeof err.message === 'string' && err.message === 'INVALID_DISCOUNT_PERCENTAGE') {
      return res.status(400).json({ message: 'Discount percentage must be between 0 and 100' })
    }
    console.error(err)
    res.status(500).json({ message: 'Failed to create order' })
  }
}

export async function getOrders(req: Request, res: Response) {
  try {
    const { status, page = 1, limit = 20, date, search } = req.query
    const where: any = {}
    if (status) where.status = String(status)
    if (date) {
      const start = new Date(String(date))
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      where.created_at = { gte: start, lt: end }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          cashier: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { created_at: 'desc' },
      }),
      prisma.order.count({ where }),
    ])

    res.json({ data: orders, total, page: Number(page), limit: Number(limit) })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch orders' })
  }
}

export async function getOrderById(req: Request, res: Response) {
  try {
    const id = String(req.params.id)
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        cashier: { select: { id: true, name: true } },
        items: { include: { product: true } },
        transaction: true,
      },
    })
    if (!order) return res.status(404).json({ message: 'Order not found' })
    res.json(order)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch order' })
  }
}

export async function getOrderReceipt(req: Request, res: Response) {
  try {
    const id = String(req.params.id)
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        cashier: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        transaction: true,
      },
    })

    if (!order) return res.status(404).json({ message: 'Order not found' })

    const subtotal = order.items.reduce(
      (sum, item) => sum + Number(item.unit_price) * item.quantity,
      0
    )

    const receipt = {
      order_id: order.id,
      date: order.created_at,
      cashier: order.cashier.name,
      items: order.items.map((item) => ({
        product_name: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: (Number(item.unit_price) * item.quantity).toFixed(2),
      })),
      subtotal: subtotal.toFixed(2),
      discount: order.discount,
      total: order.total,
      payment: order.transaction
        ? {
            method: order.transaction.payment_method,
            amount_paid: order.transaction.amount_paid,
            change: order.transaction.change,
          }
        : null,
      status: order.status,
    }

    res.json(receipt)
  } catch (err) {
    res.status(500).json({ message: 'Failed to assemble receipt' })
  }
}