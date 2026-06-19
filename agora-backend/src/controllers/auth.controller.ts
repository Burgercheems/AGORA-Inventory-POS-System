import { Request, Response } from 'express'
import { loginUser, refreshUserToken, logoutUser } from '../services/auth.service'

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const result = await loginUser(email, password)
    res.status(200).json(result)
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Login failed' })
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' })
    }

    const result = await refreshUserToken(refreshToken)
    res.status(200).json(result)
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Refresh failed' })
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' })
    }

    await logoutUser(refreshToken)
    res.status(200).json({ message: 'Logged out successfully' })
  } catch (err: any) {
    res.status(500).json({ error: 'Logout failed' })
  }
}