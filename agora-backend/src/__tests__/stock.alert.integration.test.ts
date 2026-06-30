// src/__tests__/stock.alert.integration.test.ts
// AGORA-166 — Integration tests for low-stock alert flow

import request from 'supertest'
import app from '../app'

jest.mock('../utils/prisma')

// eslint-disable-next-line @typescript-eslint/no-var-requires
const prisma = require('../utils/prisma').default

jest.mock('../middleware/auth.middleware', () => ({
  protect: (req: any, _res: any, next: any) => {
    req.user = {
      userId: 'user-001',
      role: 'ADMIN',
    }
    next()
  },
}))

jest.mock('../middleware/rateLimiter.middleware', () => ({
  apiRateLimiter:   (_req: any, _res: any, next: any) => next(),
  loginRateLimiter: (_req: any, _res: any, next: any) => next(),
}))

jest.mock('../middleware/validate.middleware', () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}))

// Mock Redis utilities — controlled per-test via mockResolvedValue
jest.mock('../utils/redis', () => ({
  getCache:               jest.fn(),
  setCache:               jest.fn(),
  invalidateCache:        jest.fn(),
  invalidateCachePattern: jest.fn(),
}))

jest.mock('../utils/notificationService', () => ({
  dispatchLowStockAlert: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../utils/socketEmitter', () => ({
  emitStockUpdate: jest.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const redis = require('../utils/redis')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal stockLevel shape returned by tx.stockLevel.update */
const mockStockLevel = (overrides = {}) => ({
  product_id:          'prod-001',
  quantity:            50,
  low_stock_threshold: 10,
  high_stock_threshold: 100,
  ...overrides,
})

/** Minimal stockMovement shape */
const mockMovement = (overrides = {}) => ({
  id:         'mov-001',
  product_id: 'prod-001',
  type:       'STOCK_OUT',
  quantity:   5,
  reason:     'sale',
  user_id:    'user-001',
  ...overrides,
})

/** Wire prisma.$transaction to invoke the callback with a fake tx client */
function mockTx({
  stockLevel,
  movement,
}: {
  stockLevel: ReturnType<typeof mockStockLevel>
  movement:   ReturnType<typeof mockMovement>
}) {
  prisma.$transaction.mockImplementation(async (cb: any) =>
    cb({
      stockLevel: {
        findUnique: jest.fn().mockResolvedValue({ quantity: stockLevel.quantity + (movement.quantity ?? 0) }),
        update:     jest.fn().mockResolvedValue(stockLevel),
      },
      stockMovement: {
        create: jest.fn().mockResolvedValue(movement),
      },
    })
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  // Default: cache misses, all Redis writes succeed silently
  redis.getCache.mockResolvedValue(null)
  redis.setCache.mockResolvedValue(undefined)
  redis.invalidateCache.mockResolvedValue(undefined)
  redis.invalidateCachePattern.mockResolvedValue(undefined)
})

// ---------------------------------------------------------------------------
// POST /api/stock/out — low-stock alert flow
// ---------------------------------------------------------------------------

describe('POST /api/stock/out — low-stock alert', () => {
  it('201 — sets low_stock_warning: false when quantity stays above threshold', async () => {
    mockTx({
      stockLevel: mockStockLevel({ quantity: 50, low_stock_threshold: 10, high_stock_threshold: 100 }),
      movement:   mockMovement({ type: 'STOCK_OUT', quantity: 5 }),
    })

    const res = await request(app)
      .post('/api/stock/out')
      .send({ product_id: 'prod-001', quantity: 5, reason: 'sale' })

    expect(res.status).toBe(201)
    expect(res.body.low_stock_warning).toBe(false)
  })

  it('201 — sets low_stock_warning: true when quantity falls to exactly the threshold', async () => {
    mockTx({
      stockLevel: mockStockLevel({ quantity: 10, low_stock_threshold: 10, high_stock_threshold: 100 }),
      movement:   mockMovement({ type: 'STOCK_OUT', quantity: 5 }),
    })

    const res = await request(app)
      .post('/api/stock/out')
      .send({ product_id: 'prod-001', quantity: 5, reason: 'sale' })

    expect(res.status).toBe(201)
    expect(res.body.low_stock_warning).toBe(true)
  })

  it('201 — sets low_stock_warning: true when quantity falls below threshold', async () => {
    mockTx({
      stockLevel: mockStockLevel({ quantity: 3, low_stock_threshold: 10, high_stock_threshold: 100 }),
      movement:   mockMovement({ type: 'STOCK_OUT', quantity: 20 }),
    })

    const res = await request(app)
      .post('/api/stock/out')
      .send({ product_id: 'prod-001', quantity: 20, reason: 'bulk-sale' })

    expect(res.status).toBe(201)
    expect(res.body.low_stock_warning).toBe(true)
  })

  it('201 — invalidates high-stock alert cache key when quantity drops below high threshold', async () => {
    mockTx({
      stockLevel: mockStockLevel({ quantity: 3, low_stock_threshold: 10, high_stock_threshold: 100 }),
      movement:   mockMovement({ type: 'STOCK_OUT', quantity: 20 }),
    })

    const res = await request(app)
      .post('/api/stock/out')
      .send({ product_id: 'prod-001', quantity: 20, reason: 'sale' })

    expect(res.status).toBe(201)
    expect(redis.invalidateCache).toHaveBeenCalledWith('alert:stock:prod-001')
  })

  it('201 — does NOT invalidate alert cache when quantity is still above high threshold', async () => {
    mockTx({
      stockLevel: mockStockLevel({ quantity: 110, low_stock_threshold: 10, high_stock_threshold: 100 }),
      movement:   mockMovement({ type: 'STOCK_OUT', quantity: 5 }),
    })

    const res = await request(app)
      .post('/api/stock/out')
      .send({ product_id: 'prod-001', quantity: 5, reason: 'sale' })

    expect(res.status).toBe(201)
    expect(redis.invalidateCache).not.toHaveBeenCalled()
  })

  it('400 — rejects when product_id is missing', async () => {
    const res = await request(app)
      .post('/api/stock/out')
      .send({ quantity: 5 })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/product_id/i)
  })

  it('400 — rejects when quantity is zero', async () => {
    const res = await request(app)
      .post('/api/stock/out')
      .send({ product_id: 'prod-001', quantity: 0 })

    expect(res.status).toBe(400)
  })

  it('404 — returns 404 when no stock level exists for the product', async () => {
    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        stockLevel:    { findUnique: jest.fn().mockResolvedValue(null) },
        stockMovement: { create: jest.fn() },
      })
    )

    const res = await request(app)
      .post('/api/stock/out')
      .send({ product_id: 'prod-999', quantity: 5 })

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/no stock level/i)
  })

  it('409 — returns 409 when requested quantity exceeds available stock', async () => {
    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        stockLevel:    { findUnique: jest.fn().mockResolvedValue({ quantity: 3 }) },
        stockMovement: { create: jest.fn() },
      })
    )

    const res = await request(app)
      .post('/api/stock/out')
      .send({ product_id: 'prod-001', quantity: 50 })

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/insufficient stock/i)
  })

  it('500 — returns 500 when Prisma throws unexpectedly', async () => {
    prisma.$transaction.mockRejectedValue(new Error('DB timeout'))

    const res = await request(app)
      .post('/api/stock/out')
      .send({ product_id: 'prod-001', quantity: 5 })

    expect(res.status).toBe(500)
    expect(res.body.message).toMatch(/failed to record stock out/i)
  })
})

// ---------------------------------------------------------------------------
// POST /api/stock/in — high-stock alert flow
// ---------------------------------------------------------------------------

describe('POST /api/stock/in — high-stock alert', () => {
  it('201 — sets high_stock_alert: false when quantity stays below high threshold', async () => {
    mockTx({
      stockLevel: mockStockLevel({ quantity: 50, high_stock_threshold: 100 }),
      movement:   mockMovement({ type: 'STOCK_IN', quantity: 10 }),
    })

    const res = await request(app)
      .post('/api/stock/in')
      .send({ product_id: 'prod-001', quantity: 10, reason: 'restock' })

    expect(res.status).toBe(201)
    expect(res.body.high_stock_alert).toBe(false)
  })

  it('201 — triggers high_stock_alert: true when quantity meets threshold and not yet alerted', async () => {
    mockTx({
      stockLevel: mockStockLevel({ quantity: 100, high_stock_threshold: 100 }),
      movement:   mockMovement({ type: 'STOCK_IN', quantity: 60 }),
    })
    redis.getCache.mockResolvedValue(null) // no prior alert

    const res = await request(app)
      .post('/api/stock/in')
      .send({ product_id: 'prod-001', quantity: 60, reason: 'restock' })

    expect(res.status).toBe(201)
    expect(res.body.high_stock_alert).toBe(true)
    expect(redis.setCache).toHaveBeenCalledWith('alert:stock:prod-001', true, 86400)
  })

  it('201 — suppresses high_stock_alert when already alerted (deduplication)', async () => {
    mockTx({
      stockLevel: mockStockLevel({ quantity: 110, high_stock_threshold: 100 }),
      movement:   mockMovement({ type: 'STOCK_IN', quantity: 60 }),
    })
    redis.getCache.mockResolvedValue(true) // already alerted

    const res = await request(app)
      .post('/api/stock/in')
      .send({ product_id: 'prod-001', quantity: 60, reason: 'restock' })

    expect(res.status).toBe(201)
    expect(res.body.high_stock_alert).toBe(false)
    expect(redis.setCache).not.toHaveBeenCalled()
  })

  it('201 — invalidates stock levels cache after stock in', async () => {
    mockTx({
      stockLevel: mockStockLevel({ quantity: 50, high_stock_threshold: 100 }),
      movement:   mockMovement({ type: 'STOCK_IN', quantity: 10 }),
    })

    const res = await request(app)
      .post('/api/stock/in')
      .send({ product_id: 'prod-001', quantity: 10, reason: 'restock' })

    expect(res.status).toBe(201)
    expect(redis.invalidateCachePattern).toHaveBeenCalledWith('stock:levels:*')
  })

  it('400 — rejects when product_id is missing', async () => {
    const res = await request(app)
      .post('/api/stock/in')
      .send({ quantity: 10 })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/product_id/i)
  })

  it('400 — rejects when quantity is negative', async () => {
    const res = await request(app)
      .post('/api/stock/in')
      .send({ product_id: 'prod-001', quantity: -5 })

    expect(res.status).toBe(400)
  })

  it('500 — returns 500 when Prisma throws unexpectedly', async () => {
    prisma.$transaction.mockRejectedValue(new Error('connection lost'))

    const res = await request(app)
      .post('/api/stock/in')
      .send({ product_id: 'prod-001', quantity: 10 })

    expect(res.status).toBe(500)
    expect(res.body.message).toMatch(/failed to record stock in/i)
  })
})