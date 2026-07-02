import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { apiRateLimiter } from '../middleware/rateLimiter.middleware'
import { validate } from '../middleware/validate.middleware'
import { auditLog } from '../middleware/audit.middleware'
import { createTransactionSchema } from '../schemas/transaction.schema'
import { createTransaction, getAllTransactions, getTransactionByOrderId } from '../controllers/transaction.controller'

const router = Router()
router.use(protect, apiRateLimiter)

router.post('/', validate(createTransactionSchema), auditLog('Transaction Module', 'CREATE', (req) => `Payment recorded for order: ${req.body.order_id}`), createTransaction)
router.get('/', getAllTransactions)
router.get('/:orderId', getTransactionByOrderId)

export default router