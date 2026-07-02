import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { apiRateLimiter } from '../middleware/rateLimiter.middleware'
import { allow } from '../middleware/rbac.middleware'
import { validate } from '../middleware/validate.middleware'
import { auditLog } from '../middleware/audit.middleware'
import { createCategorySchema, updateCategorySchema } from '../schemas/category.schema'
import { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller'

const router = Router()
router.use(protect, apiRateLimiter)

router.get('/', getCategories)
router.get('/:id', getCategoryById)
router.post('/', allow('ADMIN', 'SUPER_ADMIN'), validate(createCategorySchema), auditLog('Category Module', 'CREATE', (req) => `Created category: ${req.body.name}`), createCategory)
router.put('/:id', allow('ADMIN', 'SUPER_ADMIN'), validate(updateCategorySchema), auditLog('Category Module', 'UPDATE', (req) => `Updated category: ${req.params.id}`), updateCategory)
router.delete('/:id', allow('ADMIN', 'SUPER_ADMIN'), auditLog('Category Module', 'DELETE', (req) => `Deleted category: ${req.params.id}`), deleteCategory)

export default router