import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { apiRateLimiter } from '../middleware/rateLimiter.middleware'
import { allow } from '../middleware/rbac.middleware'
import { validate } from '../middleware/validate.middleware'
import { auditLog } from '../middleware/audit.middleware'
import { createSupplierSchema, updateSupplierSchema } from '../schemas/supplier.schema'
import { getSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier } from '../controllers/supplier.controller'

const router = Router()
router.use(protect, apiRateLimiter)

router.get('/', getSuppliers)
router.get('/:id', getSupplierById)
router.post('/', allow('ADMIN', 'SUPER_ADMIN'), validate(createSupplierSchema), auditLog('Supplier Module', 'CREATE', (req) => `Created supplier: ${req.body.name}`), createSupplier)
router.put('/:id', allow('ADMIN', 'SUPER_ADMIN'), validate(updateSupplierSchema), auditLog('Supplier Module', 'UPDATE', (req) => `Updated supplier: ${req.params.id}`), updateSupplier)
router.delete('/:id', allow('ADMIN', 'SUPER_ADMIN'), auditLog('Supplier Module', 'DELETE', (req) => `Deleted supplier: ${req.params.id}`), deleteSupplier)

export default router