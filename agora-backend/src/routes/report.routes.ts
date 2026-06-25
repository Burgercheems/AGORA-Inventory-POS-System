import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { apiRateLimiter } from '../middleware/rateLimiter.middleware'
import { allow } from '../middleware/rbac.middleware'
import { getBillingReport } from '../controllers/report.controller'

const router = Router()

router.use(protect, apiRateLimiter)

router.get('/billing', allow('ADMIN', 'SUPER_ADMIN', 'MANAGER'), getBillingReport)

export default router