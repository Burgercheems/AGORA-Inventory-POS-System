import { Router } from 'express'
import { login, refresh, logout } from '../controllers/auth.controller'
import { loginRateLimiter } from '../middleware/rateLimiter.middleware'

const router = Router()

router.post('/login', loginRateLimiter, login)
router.post('/refresh', refresh)
router.post('/logout', logout)

export default router