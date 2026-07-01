import { Request, Response } from 'express'
import prisma from '../utils/prisma'

export async function createTransaction(req: Request, res: Response) {
  try {
    const { order_id, amount_paid, payment_method } = req.body

    if (!order_id) {
      return res.status(400).json({ message: 'order_id is required' })
    }
    if (amount_paid == null) {
      return res.status(400).json({ message: 'amount_paid is required' })
    }
    if (!payment_method) {
      return res.status(400).json({ message: 'payment_method is required' })
    }

    const order = await prisma.order.findUnique({ where: { id: order_id } })
    if (!order) return res.status(404).json({ message: 'Order not found' })

    const existing = await prisma.transaction.findUnique({ where: { order_id } })
    if (existing) return res.status(409).json({ message: 'Transaction already recorded for this order' })

    const orderTotal = Number(order.total)
    if (amount_paid < orderTotal) {
      return res.status(400).json({ message: 'amount_paid is less than the order total' })
    }

    const change = amount_paid - orderTotal

    const transaction = await prisma.transaction.create({
      data: {
        order_id,
        amount_paid,
        payment_method,
        change,
        status: 'COMPLETED',
      },
    })

    res.status(201).json(transaction)
  } catch (err) {
    res.status(500).json({ message: 'Failed to record transaction' })
  }
}

export async function getTransactionByOrderId(req: Request, res: Response) {
  try {
    const orderId = String(req.params.orderId)
    const transaction = await prisma.transaction.findUnique({
      where: { order_id: orderId },
      include: { order: true },
    })
    if (!transaction) return res.status(404).json({ message: 'Transaction not found for this order' })
    res.json(transaction)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch transaction' })
  }
}

export async function getAllTransactions(req: Request, res: Response) {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        order: {
          include: {
            cashier: { select: { name: true } },
          },
        },
      },
    })
    res.json(transactions)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch transactions' })
  }
}