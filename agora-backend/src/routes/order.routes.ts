import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { apiRateLimiter } from '../middleware/rateLimiter.middleware'
import { allow } from '../middleware/rbac.middleware'
import { validate } from '../middleware/validate.middleware'
import { createOrderSchema } from '../schemas/order.schema'
import { createOrder, getOrders, getOrderById, getOrderReceipt } from '../controllers/order.controller'

const router = Router()

router.use(protect, apiRateLimiter)

router.post('/', allow('CASHIER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'), validate(createOrderSchema), createOrder)
router.get('/', getOrders)
router.get('/:id', getOrderById)
router.get('/:id/receipt', getOrderReceipt)

export default router