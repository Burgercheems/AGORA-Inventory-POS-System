import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { apiRateLimiter } from '../middleware/rateLimiter.middleware'
import { validate } from '../middleware/validate.middleware'
import { createTransactionSchema } from '../schemas/transaction.schema'
import { createTransaction, getAllTransactions, getTransactionByOrderId } from '../controllers/transaction.controller'

const router = Router()

router.use(protect, apiRateLimiter)

router.post('/', validate(createTransactionSchema), createTransaction)
router.get('/:orderId', getTransactionByOrderId)
router.post('/', validate(createTransactionSchema), createTransaction)
router.get('/', getAllTransactions)
router.get('/:orderId', getTransactionByOrderId)
export default router