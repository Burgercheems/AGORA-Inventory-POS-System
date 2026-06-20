import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { allow } from '../middleware/rbac.middleware'
import { createOrder, getOrders, getOrderById } from '../controllers/order.controller'

const router = Router()

router.post('/',   protect, allow('CASHIER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'), createOrder)
router.get('/',    protect, getOrders)
router.get('/:id', protect, getOrderById)

export default router