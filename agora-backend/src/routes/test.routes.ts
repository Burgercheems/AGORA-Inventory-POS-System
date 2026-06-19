import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { allow } from '../middleware/rbac.middleware'

const router = Router()

router.get('/protected', protect, (req, res) => {
  res.json({ message: 'You are authenticated', user: (req as any).user })
})

router.get('/admin-only', protect, allow('SUPER_ADMIN', 'ADMIN'), (req, res) => {
  res.json({ message: 'You are an admin or super admin' })
})

export default router