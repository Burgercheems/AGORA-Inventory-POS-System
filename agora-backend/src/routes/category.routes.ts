import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { allow } from '../middleware/rbac.middleware'
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller'

const router = Router()

router.get('/',       protect, getCategories)
router.get('/:id',    protect, getCategoryById)
router.post('/',      protect, allow('ADMIN', 'SUPER_ADMIN'), createCategory)
router.put('/:id',    protect, allow('ADMIN', 'SUPER_ADMIN'), updateCategory)
router.delete('/:id', protect, allow('ADMIN', 'SUPER_ADMIN'), deleteCategory)

export default router