import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt'

const prisma = new PrismaClient()

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.is_active) {
    throw new Error('Invalid credentials')
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatches) {
    throw new Error('Invalid credentials')
  }

  const payload = { userId: user.id, role: user.role }
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload)

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  })

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  }
}

export async function refreshUserToken(oldRefreshToken: string) {
  let payload
  try {
    payload = verifyRefreshToken(oldRefreshToken)
  } catch {
    throw new Error('Invalid or expired refresh token')
  }

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: oldRefreshToken },
  })

  if (!storedToken || storedToken.expires_at < new Date()) {
    throw new Error('Refresh token not recognized or expired')
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user || !user.is_active) {
    throw new Error('User not found or inactive')
  }

  await prisma.refreshToken.delete({ where: { id: storedToken.id } })

  const newPayload = { userId: user.id, role: user.role }
  const accessToken = signAccessToken(newPayload)
  const newRefreshToken = signRefreshToken(newPayload)

  await prisma.refreshToken.create({
    data: {
      token: newRefreshToken,
      userId: user.id,
      expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  })

  return { accessToken, refreshToken: newRefreshToken }
}

export async function logoutUser(refreshToken: string) {
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
}