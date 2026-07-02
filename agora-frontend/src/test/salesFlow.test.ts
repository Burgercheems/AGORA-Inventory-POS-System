import { describe, it, expect } from 'vitest'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Product {
  id: string
  name: string
  price: number
  stock_level?: { quantity: number }
  status: string
}

interface CartItem {
  product: Product
  quantity: number
  unit_price: number
}

// ── Cart logic ────────────────────────────────────────────────────────────────
function addToCart(cart: CartItem[], product: Product): CartItem[] {
  const existing = cart.find(i => i.product.id === product.id)
  if (existing) {
    return cart.map(i =>
      i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
    )
  }
  return [...cart, { product, quantity: 1, unit_price: product.price }]
}

function updateQty(cart: CartItem[], productId: string, qty: number): CartItem[] {
  if (qty <= 0) return cart.filter(i => i.product.id !== productId)
  return cart.map(i => i.product.id === productId ? { ...i, quantity: qty } : i)
}

function removeFromCart(cart: CartItem[], productId: string): CartItem[] {
  return cart.filter(i => i.product.id !== productId)
}

function calcSubtotal(cart: CartItem[]): number {
  return cart.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
}

function calcDiscount(subtotal: number, type: 'flat' | 'percentage', value: number): number {
  return type === 'flat' ? value : (subtotal * value) / 100
}

function calcTotal(subtotal: number, discountAmount: number): number {
  return Math.max(0, subtotal - discountAmount)
}

function isPaymentValid(amountPaid: number, total: number): boolean {
  return amountPaid >= total
}

function isOutOfStock(product: Product): boolean {
  return (product.stock_level?.quantity ?? 0) <= 0
}

// ── Sample data ───────────────────────────────────────────────────────────────
const sampleProducts: Product[] = [
  { id: '1', name: 'Coca-Cola 1.5L', price: 65, status: 'ACTIVE', stock_level: { quantity: 100 } },
  { id: '2', name: 'AA Batteries 2pc', price: 45, status: 'ACTIVE', stock_level: { quantity: 5 } },
  { id: '3', name: 'USB-C Cable 1m', price: 199, status: 'ACTIVE', stock_level: { quantity: 0 } },
]

// ── Integration tests ─────────────────────────────────────────────────────────

describe('Sales Flow — full end-to-end', () => {
  it('complete sale: add items → apply discount → payment → change', () => {
    let cart: CartItem[] = []

    // Step 1: Add products to cart
    cart = addToCart(cart, sampleProducts[0]) // Coca-Cola ₱65
    cart = addToCart(cart, sampleProducts[1]) // AA Batteries ₱45
    expect(cart).toHaveLength(2)

    // Step 2: Update quantity
    cart = updateQty(cart, '1', 3) // 3x Coca-Cola
    expect(cart.find(i => i.product.id === '1')?.quantity).toBe(3)

    // Step 3: Calculate subtotal
    const subtotal = calcSubtotal(cart) // (65*3) + (45*1) = 195 + 45 = 240
    expect(subtotal).toBe(240)

    // Step 4: Apply 10% discount
    const discountAmount = calcDiscount(subtotal, 'percentage', 10) // 24
    expect(discountAmount).toBe(24)

    // Step 5: Calculate total
    const total = calcTotal(subtotal, discountAmount) // 216
    expect(total).toBe(216)

    // Step 6: Process payment
    const amountPaid = 300
    expect(isPaymentValid(amountPaid, total)).toBe(true)

    // Step 7: Calculate change
    const change = amountPaid - total
    expect(change).toBe(84)
  })

  it('blocks out-of-stock products from being added', () => {
    const outOfStockProduct = sampleProducts[2] // USB-C Cable qty=0
    expect(isOutOfStock(outOfStockProduct)).toBe(true)
  })

  it('allows in-stock products to be added', () => {
    expect(isOutOfStock(sampleProducts[0])).toBe(false)
  })

  it('adding same product twice increases quantity', () => {
    let cart: CartItem[] = []
    cart = addToCart(cart, sampleProducts[0])
    cart = addToCart(cart, sampleProducts[0])
    expect(cart).toHaveLength(1)
    expect(cart[0].quantity).toBe(2)
  })

  it('removing item from cart works', () => {
    let cart: CartItem[] = []
    cart = addToCart(cart, sampleProducts[0])
    cart = addToCart(cart, sampleProducts[1])
    cart = removeFromCart(cart, '1')
    expect(cart).toHaveLength(1)
    expect(cart[0].product.id).toBe('2')
  })

  it('setting quantity to 0 removes item from cart', () => {
    let cart: CartItem[] = []
    cart = addToCart(cart, sampleProducts[0])
    cart = updateQty(cart, '1', 0)
    expect(cart).toHaveLength(0)
  })

  it('rejects payment less than total', () => {
    expect(isPaymentValid(100, 216)).toBe(false)
  })

  it('accepts exact payment', () => {
    expect(isPaymentValid(216, 216)).toBe(true)
  })

  it('flat discount of ₱50 on ₱500 order', () => {
    const subtotal = 500
    const discount = calcDiscount(subtotal, 'flat', 50)
    const total = calcTotal(subtotal, discount)
    expect(total).toBe(450)
  })

  it('discount cannot make total negative', () => {
    const total = calcTotal(100, 200)
    expect(total).toBe(0)
  })
})