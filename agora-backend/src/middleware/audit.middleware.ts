import { Request, Response, NextFunction } from 'express'
import prisma from '../utils/prisma'

export function auditLog(
  module: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  getDescription?: (req: Request) => string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res)

    res.json = function (body: any) {
      const user = (req as any).user

      const logEntry = async () => {
        if (!user?.userId) return // skip logging if no authenticated user

        const entityId =
          req.params.id ?? body?.id ?? 'unknown'

        await prisma.auditLog.create({
          data: {
            entity_type: module,
            entity_id: String(entityId),
            action,
            performed_by: user.userId,
            old_value: undefined,
            new_value: res.statusCode < 400 ? body : undefined,
          },
        }).catch((err) => console.error('[Audit] Failed to log:', err))
      }

      logEntry()
      return originalJson(body)
    }

    next()
  }
}