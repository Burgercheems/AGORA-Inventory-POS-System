import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { allow } from '../middleware/rbac.middleware'
import {
  stockIn,
  stockOut,
  getStockLevels,
  getStockMovements,
} from '../controllers/stock.controller'

const router = Router()

router.post('/in',  protect, allow('ADMIN', 'SUPER_ADMIN', 'MANAGER'), stockIn)
router.post('/out', protect, allow('ADMIN', 'SUPER_ADMIN', 'MANAGER'), stockOut)
router.get('/levels',    protect, getStockLevels)
router.get('/movements', protect, getStockMovements)

export default router