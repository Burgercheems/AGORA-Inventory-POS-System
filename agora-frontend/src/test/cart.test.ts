import { describe, it, expect } from 'vitest'

// ── cart calculation logic (extracted from OrdersPage) ────────────────────────

function calcSubtotal(cart: { unit_price: number; quantity: number }[]) {
  return cart.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
}

function calcDiscount(subtotal: number, type: 'flat' | 'percentage', value: number) {
  return type === 'flat' ? value : (subtotal * value) / 100
}

function calcTotal(subtotal: number, discountAmount: number) {
  return Math.max(0, subtotal - discountAmount)
}

function calcChange(amountPaid: number, total: number) {
  return amountPaid - total
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('Cart — subtotal', () => {
  it('calculates subtotal for single item', () => {
    expect(calcSubtotal([{ unit_price: 100, quantity: 2 }])).toBe(200)
  })

  it('calculates subtotal for multiple items', () => {
    expect(calcSubtotal([
      { unit_price: 50, quantity: 3 },
      { unit_price: 25, quantity: 2 },
    ])).toBe(200)
  })

  it('returns 0 for empty cart', () => {
    expect(calcSubtotal([])).toBe(0)
  })
})

describe('Cart — discount', () => {
  it('applies flat discount correctly', () => {
    expect(calcDiscount(500, 'flat', 50)).toBe(50)
  })

  it('applies percentage discount correctly', () => {
    expect(calcDiscount(500, 'percentage', 10)).toBe(50)
  })

  it('applies 0 discount', () => {
    expect(calcDiscount(500, 'flat', 0)).toBe(0)
  })

  it('applies 100% discount', () => {
    expect(calcDiscount(500, 'percentage', 100)).toBe(500)
  })
})

describe('Cart — total', () => {
  it('subtracts discount from subtotal', () => {
    expect(calcTotal(500, 50)).toBe(450)
  })

  it('never goes below zero', () => {
    expect(calcTotal(100, 200)).toBe(0)
  })

  it('returns subtotal when no discount', () => {
    expect(calcTotal(300, 0)).toBe(300)
  })
})

describe('Cart — change', () => {
  it('calculates change correctly', () => {
    expect(calcChange(500, 350)).toBe(150)
  })

  it('returns 0 when exact amount paid', () => {
    expect(calcChange(350, 350)).toBe(0)
  })
})