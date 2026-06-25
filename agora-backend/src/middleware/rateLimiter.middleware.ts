import { RateLimiterRedis } from 'rate-limiter-flexible'
import { redis } from '../utils/redis'
import { Request, Response, NextFunction } from 'express'

const loginLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:login',
  points: 5,
  duration: 900,
  blockDuration: 900,
})

const apiLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl:api',
  points: 100,
  duration: 60,
})

export const loginRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await loginLimiter.consume(req.ip!)
    next()
  } catch {
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Try again in 15 minutes.',
    })
  }
}

export const apiRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const key = (req as any).user?.userId ?? req.ip!
    await apiLimiter.consume(key)
    next()
  } catch {
    res.status(429).json({
      success: false,
      message: 'Too many requests. Slow down.',
    })
  }
}