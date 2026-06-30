import { Request, Response, NextFunction } from 'express'

const mockConsume = jest.fn()

jest.mock('rate-limiter-flexible', () => ({
  RateLimiterRedis: jest.fn().mockImplementation(() => ({
    consume: mockConsume,
  })),
}))

jest.mock('../utils/redis', () => ({
  redis: {},
}))

import { loginRateLimiter, apiRateLimiter } from '../middleware/rateLimiter.middleware'

function mockReq(overrides: any = {}): Request {
  return {
    ip: '127.0.0.1',
    ...overrides,
  } as any
}

function mockRes(): Response {
  const res: any = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

describe('loginRateLimiter', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls next() when under the rate limit', async () => {
    mockConsume.mockResolvedValue(undefined)

    const req = mockReq()
    const res = mockRes()
    const next = jest.fn()

    await loginRateLimiter(req, res, next)

    expect(mockConsume).toHaveBeenCalledWith('127.0.0.1')
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 429 when the rate limit is exceeded', async () => {
    mockConsume.mockRejectedValue(new Error('Rate limit exceeded'))

    const req = mockReq()
    const res = mockRes()
    const next = jest.fn()

    await loginRateLimiter(req, res, next)

    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/too many login attempts/i),
      })
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('simulates 50 successful attempts followed by a 51st that gets blocked', async () => {
    // First 50 calls succeed
    for (let i = 0; i < 50; i++) {
      mockConsume.mockResolvedValueOnce(undefined)
    }
    // 51st call exceeds the limit
    mockConsume.mockRejectedValueOnce(new Error('Rate limit exceeded'))

    const next = jest.fn()

    for (let i = 0; i < 50; i++) {
      const req = mockReq()
      const res = mockRes()
      await loginRateLimiter(req, res, next)
      expect(res.status).not.toHaveBeenCalled()
    }

    expect(next).toHaveBeenCalledTimes(50)

    // 51st attempt
    const req = mockReq()
    const res = mockRes()
    await loginRateLimiter(req, res, next)

    expect(res.status).toHaveBeenCalledWith(429)
    expect(next).toHaveBeenCalledTimes(50) // still 50 — the 51st did not call next
  })

  it('uses the request IP as the rate limit key', async () => {
    mockConsume.mockResolvedValue(undefined)

    const req = mockReq({ ip: '203.0.113.42' })
    const res = mockRes()
    const next = jest.fn()

    await loginRateLimiter(req, res, next)

    expect(mockConsume).toHaveBeenCalledWith('203.0.113.42')
  })
})

describe('apiRateLimiter', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls next() when under the rate limit', async () => {
    mockConsume.mockResolvedValue(undefined)

    const req = mockReq()
    const res = mockRes()
    const next = jest.fn()

    await apiRateLimiter(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('returns 429 when the rate limit is exceeded', async () => {
    mockConsume.mockRejectedValue(new Error('Rate limit exceeded'))

    const req = mockReq()
    const res = mockRes()
    const next = jest.fn()

    await apiRateLimiter(req, res, next)

    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/too many requests/i),
      })
    )
  })

  it('uses the authenticated userId as the rate limit key when available', async () => {
    mockConsume.mockResolvedValue(undefined)

    const req = mockReq({ user: { userId: 'user-001' } })
    const res = mockRes()
    const next = jest.fn()

    await apiRateLimiter(req, res, next)

    expect(mockConsume).toHaveBeenCalledWith('user-001')
  })

  it('falls back to IP when there is no authenticated user', async () => {
    mockConsume.mockResolvedValue(undefined)

    const req = mockReq({ ip: '198.51.100.7' })
    const res = mockRes()
    const next = jest.fn()

    await apiRateLimiter(req, res, next)

    expect(mockConsume).toHaveBeenCalledWith('198.51.100.7')
  })
})