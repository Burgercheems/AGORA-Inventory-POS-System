import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt'

const prisma = new PrismaClient()

// NOTE: RefreshToken table is gone, so refresh tokens are now stateless JWTs —
// validity is checked by signature + expiry only, not against the DB.
// This means logout can no longer truly revoke a token server-side; it only
// clears the cookie client-side. If the CEO needs hard revocation (e.g. for
// stolen-token scenarios), we'd need a lightweight denylist table (just
// token-id + expiry, not full refresh token storage) — flag this if it matters.

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  })

  if (!user || !user.is_active) {
    throw new Error('Invalid credentials')
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatches) {
    throw new Error('Invalid credentials')
  }

  const payload = { userId: user.id, role: user.role.role_name }
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload)

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.role_name,
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

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { role: true },
  })
  if (!user || !user.is_active) {
    throw new Error('User not found or inactive')
  }

  const newPayload = { userId: user.id, role: user.role.role_name }
  const accessToken = signAccessToken(newPayload)
  const newRefreshToken = signRefreshToken(newPayload)

  return { accessToken, refreshToken: newRefreshToken }
}

export async function logoutUser(_refreshToken: string) {
  // Stateless tokens: nothing to delete server-side. Cookie clearing happens
  // in the controller. This is a no-op placeholder in case a denylist gets
  // added later.
  return
}