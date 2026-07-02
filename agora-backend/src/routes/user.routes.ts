import { Router } from 'express'
import { protect } from '../middleware/auth.middleware'
import { apiRateLimiter } from '../middleware/rateLimiter.middleware'
import { allow } from '../middleware/rbac.middleware'
import { auditLog } from '../middleware/audit.middleware'
import { getUsers, createUser, updateUser, toggleUserStatus, deleteUser } from '../controllers/user.controller'

const router = Router()
router.use(protect, apiRateLimiter)

router.get('/', allow('ADMIN', 'SUPER_ADMIN'), getUsers)
router.post('/', allow('ADMIN', 'SUPER_ADMIN'), auditLog('User Module', 'CREATE', (req) => `Created user: ${req.body.email}`), createUser)
router.put('/:id', allow('ADMIN', 'SUPER_ADMIN'), auditLog('User Module', 'UPDATE', (req) => `Updated user: ${req.params.id}`), updateUser)
router.patch('/:id/status', allow('ADMIN', 'SUPER_ADMIN'), auditLog('User Module', 'ADJUST', (req) => `Toggled status for user: ${req.params.id}`), toggleUserStatus)
router.delete('/:id', allow('SUPER_ADMIN'), auditLog('User Module', 'DELETE', (req) => `Deleted user: ${req.params.id}`), deleteUser)

export default router