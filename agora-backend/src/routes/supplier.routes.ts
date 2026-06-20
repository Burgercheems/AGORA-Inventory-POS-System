    import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { allow } from '../middleware/rbac.middleware'
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplier.controller'

const router = Router()

router.get('/',       protect, getSuppliers)
router.get('/:id',    protect, getSupplierById)
router.post('/',      protect, allow('ADMIN', 'SUPER_ADMIN'), createSupplier)
router.put('/:id',    protect, allow('ADMIN', 'SUPER_ADMIN'), updateSupplier)
router.delete('/:id', protect, allow('ADMIN', 'SUPER_ADMIN'), deleteSupplier)

export default router