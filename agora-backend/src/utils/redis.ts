import Redis from 'ioredis'
import dotenv from 'dotenv'
dotenv.config()

export const redis = new Redis(process.env.REDIS_URL!)
redis.on('connect', () => console.log('✅ Redis connected'))
redis.on('error', (err) => console.error('❌ Redis error:', err))

export const getCache = async <T>(key: string): Promise<T | null> => {
  const val = await redis.get(key)
  return val ? (JSON.parse(val) as T) : null
}

export const setCache = async (key: string, data: unknown, ttlSeconds = 60): Promise<void> => {
  await redis.setex(key, ttlSeconds, JSON.stringify(data))
}

export const invalidateCache = async (key: string): Promise<void> => {
  await redis.del(key)
}

// Pattern delete — use for dynamic cache keys e.g. invalidateCachePattern('stock:levels:*')
export const invalidateCachePattern = async (pattern: string): Promise<void> => {
  const keys = await redis.keys(pattern)
  if (keys.length > 0) await redis.del(...keys)
}