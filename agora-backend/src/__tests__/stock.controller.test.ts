import { stockIn, stockOut, getStockLevels, getStockMovements } from '../controllers/stock.controller'
import prisma from '../utils/prisma'
import { getCache, setCache, invalidateCache, invalidateCachePattern } from '../utils/redis'

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    stockLevel: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    product: {
      findUnique: jest.fn().mockResolvedValue({ name: 'Test Product' }),
    },
  },
}))

jest.mock('../utils/redis', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
  invalidateCache: jest.fn(),
  invalidateCachePattern: jest.fn(),
}))

jest.mock('../utils/socketEmitter', () => ({
  emitStockUpdate: jest.fn(),
}))

jest.mock('../utils/notificationService', () => ({
  dispatchLowStockAlert: jest.fn().mockResolvedValue(undefined),
}))


jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    stockLevel: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    product: {
      findUnique: jest.fn().mockResolvedValue({ name: 'Test Product' }),
    },
  },
}))

jest.mock('../utils/redis', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
  invalidateCache: jest.fn(),
  invalidateCachePattern: jest.fn(),
}))

jest.mock('../utils/socketEmitter', () => ({
  emitStockUpdate: jest.fn(),
}))

jest.mock('../utils/notificationService', () => ({
  dispatchLowStockAlert: jest.fn().mockResolvedValue(undefined),
}))

function mockRes() {
  const res: any = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

function mockReq(overrides: any = {}) {
  return {
    body: {},
    query: {},
    user: { userId: 'user-1' },
    ...overrides,
  } as any
}

describe('stockIn', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 if product_id is missing', async () => {
    const req = mockReq({ body: { quantity: 5 } })
    const res = mockRes()
    await stockIn(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 400 if quantity is missing', async () => {
    const req = mockReq({ body: { product_id: 'p1' } })
    const res = mockRes()
    await stockIn(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 400 if quantity is 0 or negative', async () => {
    const req = mockReq({ body: { product_id: 'p1', quantity: 0 } })
    const res = mockRes()
    await stockIn(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('records stock in and returns 201 without alert when below high threshold', async () => {
    const req = mockReq({ body: { product_id: 'p1', quantity: 10, reason: 'restock' } })
    const res = mockRes()

    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
      return cb({
        stockMovement: { create: jest.fn().mockResolvedValue({ id: 'm1' }) },
        stockLevel: {
          update: jest.fn().mockResolvedValue({ quantity: 50, high_stock_threshold: 100 }),
        },
      })
    })

    await stockIn(req, res)

    expect(invalidateCachePattern).toHaveBeenCalledWith('stock:levels:*')
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ high_stock_alert: false })
    )
  })

  it('triggers high_stock_alert when quantity crosses threshold and not already alerted', async () => {
    const req = mockReq({ body: { product_id: 'p1', quantity: 60, reason: 'restock' } })
    const res = mockRes()

    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
      return cb({
        stockMovement: { create: jest.fn().mockResolvedValue({ id: 'm1' }) },
        stockLevel: {
          update: jest.fn().mockResolvedValue({ quantity: 110, high_stock_threshold: 100 }),
        },
      })
    })
    ;(getCache as jest.Mock).mockResolvedValue(null)

    await stockIn(req, res)

    expect(setCache).toHaveBeenCalledWith('alert:stock:p1', true, 86400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ high_stock_alert: true })
    )
  })

  it('does not re-trigger high_stock_alert if already alerted', async () => {
    const req = mockReq({ body: { product_id: 'p1', quantity: 60 } })
    const res = mockRes()

    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
      return cb({
        stockMovement: { create: jest.fn().mockResolvedValue({ id: 'm1' }) },
        stockLevel: {
          update: jest.fn().mockResolvedValue({ quantity: 110, high_stock_threshold: 100 }),
        },
      })
    })
    ;(getCache as jest.Mock).mockResolvedValue(true)

    await stockIn(req, res)

    expect(setCache).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ high_stock_alert: false })
    )
  })

  it('returns 500 on unexpected error', async () => {
    const req = mockReq({ body: { product_id: 'p1', quantity: 10 } })
    const res = mockRes()

    ;(prisma.$transaction as jest.Mock).mockRejectedValue(new Error('DB down'))

    await stockIn(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })
})

describe('stockOut', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 400 if product_id or quantity missing/invalid', async () => {
    const req = mockReq({ body: { quantity: -5 } })
    const res = mockRes()
    await stockOut(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('returns 404 when no stock level exists', async () => {
    const req = mockReq({ body: { product_id: 'p1', quantity: 5 } })
    const res = mockRes()

    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
      return cb({
        stockLevel: { findUnique: jest.fn().mockResolvedValue(null) },
        stockMovement: { create: jest.fn() },
      })
    })

    await stockOut(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('returns 409 when insufficient stock', async () => {
    const req = mockReq({ body: { product_id: 'p1', quantity: 50 } })
    const res = mockRes()

    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
      return cb({
        stockLevel: { findUnique: jest.fn().mockResolvedValue({ quantity: 10 }) },
        stockMovement: { create: jest.fn() },
      })
    })

    await stockOut(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
  })

  it('records stock out and returns 201 with low_stock_warning true when at/below threshold', async () => {
    const req = mockReq({ body: { product_id: 'p1', quantity: 10, reason: 'sale' } })
    const res = mockRes()

    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
      return cb({
        stockLevel: {
          findUnique: jest.fn().mockResolvedValue({ quantity: 15 }),
          update: jest.fn().mockResolvedValue({
            quantity: 5,
            high_stock_threshold: 100,
            low_stock_threshold: 10,
          }),
        },
        stockMovement: { create: jest.fn().mockResolvedValue({ id: 'm2' }) },
      })
    })

    await stockOut(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ low_stock_warning: true })
    )
    expect(invalidateCache).toHaveBeenCalledWith('alert:stock:p1')
  })

  it('returns low_stock_warning false when above threshold', async () => {
    const req = mockReq({ body: { product_id: 'p1', quantity: 5 } })
    const res = mockRes()

    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
      return cb({
        stockLevel: {
          findUnique: jest.fn().mockResolvedValue({ quantity: 50 }),
          update: jest.fn().mockResolvedValue({
            quantity: 45,
            high_stock_threshold: 100,
            low_stock_threshold: 10,
          }),
        },
        stockMovement: { create: jest.fn().mockResolvedValue({ id: 'm3' }) },
      })
    })

    await stockOut(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ low_stock_warning: false })
    )
  })

  it('returns 500 on unexpected error', async () => {
    const req = mockReq({ body: { product_id: 'p1', quantity: 5 } })
    const res = mockRes()

    ;(prisma.$transaction as jest.Mock).mockRejectedValue(new Error('boom'))

    await stockOut(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })
})

describe('getStockLevels', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns cached response if available', async () => {
    const req = mockReq({ query: {} })
    const res = mockRes()
    const cached = { data: [], total: 0, page: 1, limit: 50 }

    ;(getCache as jest.Mock).mockResolvedValue(cached)

    await getStockLevels(req, res)

    expect(res.json).toHaveBeenCalledWith(cached)
    expect(prisma.stockLevel.findMany).not.toHaveBeenCalled()
  })

  it('fetches from DB, caches, and returns response when no cache', async () => {
    const req = mockReq({ query: { page: '1', limit: '50' } })
    const res = mockRes()

    ;(getCache as jest.Mock).mockResolvedValue(null)
    ;(prisma.stockLevel.findMany as jest.Mock).mockResolvedValue([
      { quantity: 5, low_stock_threshold: 10, product: { id: 'p1', name: 'A' } },
    ])
    ;(prisma.stockLevel.count as jest.Mock).mockResolvedValue(1)

    await getStockLevels(req, res)

    expect(setCache).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ total: 1, page: 1, limit: 50 })
    )
  })

  it('filters to low stock items when low_stock=true', async () => {
    const req = mockReq({ query: { low_stock: 'true' } })
    const res = mockRes()

    ;(getCache as jest.Mock).mockResolvedValue(null)
    ;(prisma.stockLevel.findMany as jest.Mock).mockResolvedValue([
      { quantity: 5, low_stock_threshold: 10, product: { id: 'p1' } },
      { quantity: 50, low_stock_threshold: 10, product: { id: 'p2' } },
    ])
    ;(prisma.stockLevel.count as jest.Mock).mockResolvedValue(2)

    await getStockLevels(req, res)

    const jsonArg = (res.json as jest.Mock).mock.calls[0][0]
    expect(jsonArg.data).toHaveLength(1)
    expect(jsonArg.data[0].product.id).toBe('p1')
  })

  it('returns 500 on error', async () => {
    const req = mockReq({ query: {} })
    const res = mockRes()

    ;(getCache as jest.Mock).mockRejectedValue(new Error('redis down'))

    await getStockLevels(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })
})

describe('getStockMovements', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns movements with pagination', async () => {
    const req = mockReq({ query: {} })
    const res = mockRes()

    ;(prisma.stockMovement.findMany as jest.Mock).mockResolvedValue([{ id: 'm1' }])
    ;(prisma.stockMovement.count as jest.Mock).mockResolvedValue(1)

    await getStockMovements(req, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ id: 'm1' }], total: 1, page: 1, limit: 20 })
    )
  })

  it('filters by product_id and type when provided', async () => {
    const req = mockReq({ query: { product_id: 'p1', type: 'STOCK_IN' } })
    const res = mockRes()

    ;(prisma.stockMovement.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.stockMovement.count as jest.Mock).mockResolvedValue(0)

    await getStockMovements(req, res)

    expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { product_id: 'p1', type: 'STOCK_IN' },
      })
    )
  })

  it('returns 500 on error', async () => {
    const req = mockReq({ query: {} })
    const res = mockRes()

    ;(prisma.stockMovement.findMany as jest.Mock).mockRejectedValue(new Error('fail'))

    await getStockMovements(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })
})