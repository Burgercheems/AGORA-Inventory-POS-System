import { Request, Response, NextFunction } from 'express'
import { auditLog } from '../middleware/audit.middleware'
import prisma from '../utils/prisma'

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}))

function mockReq(overrides: any = {}): Request {
  return {
    params: {},
    body: {},
    ip: '127.0.0.1',
    user: { userId: 'user-001', role: 'ADMIN' },
    ...overrides,
  } as any
}

function mockRes(): Response {
  const res: any = {}
  res.statusCode = 200
  res.json = jest.fn().mockReturnValue(res)
  return res
}

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve))
}

describe('auditLog middleware', () => {
  beforeEach(() => jest.clearAllMocks())

  it('logs a CREATE action for the Order module', async () => {
    const middleware = auditLog('Order Module', 'CREATE', () => 'Created new order')
    const req = mockReq({ body: {} })
    const res = mockRes()
    const next = jest.fn()

    middleware(req, res, next)
    expect(next).toHaveBeenCalled()

    res.json({ id: 'order-001' })
    await flushPromises()

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entity_type: 'Order Module',
          action: 'CREATE',
          performed_by: 'user-001',
        }),
      })
    )
  })

  it('logs an UPDATE action for the Product module with correct entity_id from params', async () => {
    const middleware = auditLog('Inventory Module', 'UPDATE', (req) => `Updated product: ${req.params.id}`)
    const req = mockReq({ params: { id: 'prod-123' } })
    const res = mockRes()
    const next = jest.fn()

    middleware(req, res, next)
    res.json({ id: 'prod-123' })
    await flushPromises()

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entity_type: 'Inventory Module',
          entity_id: 'prod-123',
          action: 'UPDATE',
        }),
      })
    )
  })

  it('logs a DELETE action for the Product module', async () => {
    const middleware = auditLog('Inventory Module', 'DELETE', (req) => `Deleted product: ${req.params.id}`)
    const req = mockReq({ params: { id: 'prod-999' } })
    const res = mockRes()
    const next = jest.fn()

    middleware(req, res, next)
    res.json({})
    await flushPromises()

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entity_type: 'Inventory Module',
          entity_id: 'prod-999',
          action: 'DELETE',
        }),
      })
    )
  })

  it('logs a CREATE action for the Stock module (stock in)', async () => {
    const middleware = auditLog('Stock Module', 'CREATE', (req) => `Stock In: ${req.body.quantity} units`)
    const req = mockReq({ body: { product_id: 'prod-001', quantity: 50 } })
    const res = mockRes()
    const next = jest.fn()

    middleware(req, res, next)
    res.json({ id: 'mov-001' })
    await flushPromises()

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entity_type: 'Stock Module',
          action: 'CREATE',
          performed_by: 'user-001',
        }),
      })
    )
  })

  it('does not log when there is no authenticated user', async () => {
    const middleware = auditLog('Order Module', 'CREATE')
    const req = mockReq({ user: undefined })
    const res = mockRes()
    const next = jest.fn()

    middleware(req, res, next)
    res.json({ id: 'order-002' })
    await flushPromises()

    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('still calls next() and returns the response even if audit logging fails', async () => {
    ;(prisma.auditLog.create as jest.Mock).mockRejectedValueOnce(new Error('DB down'))

    const middleware = auditLog('Order Module', 'CREATE')
    const req = mockReq()
    const res = mockRes()
    const next = jest.fn()

    middleware(req, res, next)
    const result = res.json({ id: 'order-003' })
    await flushPromises()

    expect(next).toHaveBeenCalled()
    expect(result).toBe(res)
  })

  it('falls back to body.id as entity_id when no params.id is present', async () => {
    const middleware = auditLog('Order Module', 'CREATE')
    const req = mockReq({ params: {} })
    const res = mockRes()
    const next = jest.fn()

    middleware(req, res, next)
    res.json({ id: 'order-fallback-001' })
    await flushPromises()

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entity_id: 'order-fallback-001',
        }),
      })
    )
  })

  it('does not set new_value when response status indicates failure', async () => {
    const middleware = auditLog('Order Module', 'CREATE')
    const req = mockReq()
    const res = mockRes()
    res.statusCode = 500
    const next = jest.fn()

    middleware(req, res, next)
    res.json({ message: 'error' })
    await flushPromises()

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          new_value: undefined,
        }),
      })
    )
  })
})