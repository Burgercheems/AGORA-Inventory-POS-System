import { Router } from 'express'
import { login, refresh, logout } from '../controllers/auth.controller'
import { loginRateLimiter } from '../middleware/rateLimiter.middleware'
import { auditLog } from '../middleware/audit.middleware'

const router = Router()

router.post(
  '/login',
  loginRateLimiter,
  auditLog('Auth Module', 'LOGIN', (req) => `Login attempt: ${req.body.email}`),
  login
)
router.post('/refresh', refresh)
router.post(
  '/logout',
  auditLog('Auth Module', 'LOGOUT', () => 'User logged out'),
  logout
)

export default router