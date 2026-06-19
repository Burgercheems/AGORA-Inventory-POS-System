import { Request, Response, NextFunction } from 'express'

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CASHIER'

export function allow(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role as Role
    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role' })
    }
    next()
  }
}