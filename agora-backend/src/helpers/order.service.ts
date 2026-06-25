type DiscountType = 'FLAT' | 'PERCENTAGE'

export function calculateDiscount(
  subtotal: number,
  discount_type?: DiscountType,
  discount_value?: number
): number {
  if (!discount_type || !discount_value) return 0

  if (discount_type === 'FLAT') {
    return Math.min(discount_value, subtotal)
  }

  if (discount_type === 'PERCENTAGE') {
    if (discount_value < 0 || discount_value > 100) {
      throw new Error('INVALID_DISCOUNT_PERCENTAGE')
    }
    return (subtotal * discount_value) / 100
  }

  throw new Error('INVALID_DISCOUNT_TYPE')
}