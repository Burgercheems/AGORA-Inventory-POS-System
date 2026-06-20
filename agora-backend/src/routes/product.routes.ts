import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { allow } from '../middleware/rbac.middleware'
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller'

const router = Router()

router.get('/',       protect, getProducts)
router.get('/:id',    protect, getProductById)
router.post('/',      protect, allow('ADMIN', 'SUPER_ADMIN'), createProduct)
router.put('/:id',    protect, allow('ADMIN', 'SUPER_ADMIN'), updateProduct)
router.delete('/:id', protect, allow('ADMIN', 'SUPER_ADMIN'), deleteProduct)

export default router