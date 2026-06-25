import { Request, Response } from 'express'
import prisma from '../utils/prisma'

export async function getBillingReport(req: Request, res: Response) {
  try {
    const { date, start_date, end_date } = req.query

    let dateFilter: any = {}

    if (date) {
      const start = new Date(String(date))
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      dateFilter = { gte: start, lt: end }
    } else if (start_date && end_date) {
      dateFilter = {
        gte: new Date(String(start_date)),
        lt: new Date(String(end_date)),
      }
    } else {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      dateFilter = { gte: today, lt: tomorrow }
    }

    const transactions = await prisma.transaction.findMany({
      where: { created_at: dateFilter },
      include: {
        order: {
          include: {
            cashier: { select: { id: true, name: true } },
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
              },
            },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    })

    const grand_total = transactions.reduce(
      (sum, t) => sum + Number(t.order.total),
      0
    )

    const report = {
      date: date ?? `${start_date} to ${end_date}`,
      transaction_count: transactions.length,
      grand_total: grand_total.toFixed(2),
      transactions: transactions.map((t) => ({
        transaction_id: t.id,
        order_id: t.order_id,
        created_at: t.created_at,
        cashier: t.order.cashier.name,
        items: t.order.items.map((i) => ({
          product_name: i.product.name,
          sku: i.product.sku,
          quantity: i.quantity,
          unit_price: i.unit_price,
          line_total: (Number(i.unit_price) * i.quantity).toFixed(2),
        })),
        subtotal: t.order.items
          .reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0)
          .toFixed(2),
        discount: t.order.discount,
        total: t.order.total,
        payment_method: t.payment_method,
        amount_paid: t.amount_paid,
        change: t.change,
        status: t.status,
      })),
    }

    res.json(report)
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate billing report' })
  }
}