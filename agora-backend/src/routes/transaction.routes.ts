import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { createTransaction, getTransactionByOrderId } from '../controllers/transaction.controller'

const router = Router()

router.post('/', protect, createTransaction)
router.get('/:orderId', protect, getTransactionByOrderId)

export default router