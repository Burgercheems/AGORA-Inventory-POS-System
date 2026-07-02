import { describe, it, expect } from 'vitest'

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CASHIER'

// ── RBAC logic (extracted from ProtectedRoute) ────────────────────────────────
function canAccess(userRole: Role, allowedRoles?: Role[]): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true
  return allowedRoles.includes(userRole)
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('RBAC — route access', () => {
  it('allows access when no roles required', () => {
    expect(canAccess('CASHIER', [])).toBe(true)
    expect(canAccess('CASHIER', undefined)).toBe(true)
  })

  it('SUPER_ADMIN can access all restricted routes', () => {
    expect(canAccess('SUPER_ADMIN', ['ADMIN', 'SUPER_ADMIN'])).toBe(true)
    expect(canAccess('SUPER_ADMIN', ['ADMIN', 'SUPER_ADMIN', 'MANAGER'])).toBe(true)
  })

  it('CASHIER cannot access admin routes', () => {
    expect(canAccess('CASHIER', ['ADMIN', 'SUPER_ADMIN'])).toBe(false)
  })

  it('CASHIER cannot access manager routes', () => {
    expect(canAccess('CASHIER', ['ADMIN', 'SUPER_ADMIN', 'MANAGER'])).toBe(false)
  })

  it('MANAGER can access manager routes', () => {
    expect(canAccess('MANAGER', ['ADMIN', 'SUPER_ADMIN', 'MANAGER'])).toBe(true)
  })

  it('MANAGER cannot access admin-only routes', () => {
    expect(canAccess('MANAGER', ['ADMIN', 'SUPER_ADMIN'])).toBe(false)
  })

  it('ADMIN can access admin routes', () => {
    expect(canAccess('ADMIN', ['ADMIN', 'SUPER_ADMIN'])).toBe(true)
  })

  it('ADMIN cannot access super admin only routes', () => {
    expect(canAccess('ADMIN', ['SUPER_ADMIN'])).toBe(false)
  })
})

describe('RBAC — role hierarchy', () => {
  const roles: Role[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER']

  it('all roles can access public routes', () => {
    roles.forEach(role => {
      expect(canAccess(role, [])).toBe(true)
    })
  })

  it('only SUPER_ADMIN and ADMIN can access inventory', () => {
    expect(canAccess('SUPER_ADMIN', ['ADMIN', 'SUPER_ADMIN'])).toBe(true)
    expect(canAccess('ADMIN', ['ADMIN', 'SUPER_ADMIN'])).toBe(true)
    expect(canAccess('MANAGER', ['ADMIN', 'SUPER_ADMIN'])).toBe(false)
    expect(canAccess('CASHIER', ['ADMIN', 'SUPER_ADMIN'])).toBe(false)
  })

  it('only SUPER_ADMIN can access super admin controls', () => {
    expect(canAccess('SUPER_ADMIN', ['SUPER_ADMIN'])).toBe(true)
    expect(canAccess('ADMIN', ['SUPER_ADMIN'])).toBe(false)
    expect(canAccess('MANAGER', ['SUPER_ADMIN'])).toBe(false)
    expect(canAccess('CASHIER', ['SUPER_ADMIN'])).toBe(false)
  })
})