import { Request, Response, NextFunction } from 'express'
import prisma from '../utils/prisma'
import { getCache, setCache } from '../utils/redis'

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CASHIER'

export const allow = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role_id as Role
    if (!roles.includes(userRole)) {
      res.status(403).json({ success: false, message: 'Forbidden: insufficient role' })
      return
    }
    next()
  }
}

export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user
      if (!user) {
        res.status(401).json({ success: false, message: 'Unauthorized' })
        return
      }

      const cacheKey = `perms:${user.role_id}`
      let permissions = await getCache<string[]>(cacheKey)

      if (!permissions) {
        const rolePermissions = await prisma.rolePermission.findMany({
          where: { role_id: user.role_id },
          include: { permission: true },
        })
        permissions = rolePermissions.map(
          (rp: { permission: { permission_name: string } }) => rp.permission.permission_name
        )
        await setCache(cacheKey, permissions, 300)
      }

      if (!(permissions as string[]).includes(permission)) {
        res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' })
        return
      }

      next()
    } catch (err) {
      next(err)
    }
  }
}