import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { apiRateLimiter } from '../middleware/rateLimiter.middleware'
import { allow } from '../middleware/rbac.middleware'
import { validate } from '../middleware/validate.middleware'
import { createSupplierSchema, updateSupplierSchema } from '../schemas/supplier.schema'
import { getSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier } from '../controllers/supplier.controller'

const router = Router()

router.use(protect, apiRateLimiter)

router.get('/', getSuppliers)
router.get('/:id', getSupplierById)
router.post('/', allow('ADMIN', 'SUPER_ADMIN'), validate(createSupplierSchema), createSupplier)
router.put('/:id', allow('ADMIN', 'SUPER_ADMIN'), validate(updateSupplierSchema), updateSupplier)
router.delete('/:id', allow('ADMIN', 'SUPER_ADMIN'), deleteSupplier)

export default router