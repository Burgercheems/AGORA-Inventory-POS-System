import { Request, Response } from 'express'
import { loginUser, refreshUserToken, logoutUser } from '../helpers/auth.service'

const REFRESH_COOKIE_NAME = 'refreshToken'
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }
    const { accessToken, refreshToken, user } = await loginUser(email, password)
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS)
    res.status(200).json({ accessToken, user })
  } catch (err: any) {
    // safe to expose these specific messages to the client
    const safeMessages = [
      'Invalid credentials',
      'Account locked',
      'Too many failed attempts',
    ]
    const isSafe = safeMessages.some((m) => err.message?.startsWith(m))
    res.status(401).json({ error: isSafe ? err.message : 'Login failed' })
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const oldRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME]
    if (!oldRefreshToken) {
      return res.status(401).json({ error: 'Refresh token missing' })
    }
    const { accessToken, refreshToken } = await refreshUserToken(oldRefreshToken)
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS)
    res.status(200).json({ accessToken })
  } catch {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' })
    res.status(401).json({ error: 'Session expired. Please log in again.' })
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME]
    if (refreshToken) await logoutUser(refreshToken)
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' })
    res.status(200).json({ message: 'Logged out successfully' })
  } catch {
    res.status(500).json({ error: 'Logout failed' })
  }
}