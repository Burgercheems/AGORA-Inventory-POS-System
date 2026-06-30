import { calculateDiscount } from '../helpers/order.service'

describe('calculateDiscount', () => {
  it('returns 0 when no discount_type is provided', () => {
    expect(calculateDiscount(1000)).toBe(0)
  })

  it('returns 0 when no discount_value is provided', () => {
    expect(calculateDiscount(1000, 'FLAT')).toBe(0)
  })

  it('returns 0 when discount_value is 0', () => {
    expect(calculateDiscount(1000, 'FLAT', 0)).toBe(0)
  })

  describe('FLAT discount', () => {
    it('subtracts the flat amount from subtotal', () => {
      expect(calculateDiscount(1000, 'FLAT', 100)).toBe(100)
    })

    it('caps the discount at the subtotal (cannot discount more than the order total)', () => {
      expect(calculateDiscount(50, 'FLAT', 200)).toBe(50)
    })

    it('returns the exact subtotal when discount equals subtotal', () => {
      expect(calculateDiscount(500, 'FLAT', 500)).toBe(500)
    })
  })

  describe('PERCENTAGE discount', () => {
    it('calculates a percentage discount correctly', () => {
      expect(calculateDiscount(1000, 'PERCENTAGE', 10)).toBe(100)
    })

    it('handles 100% discount (free order)', () => {
      expect(calculateDiscount(500, 'PERCENTAGE', 100)).toBe(500)
    })

    it('handles 0% discount', () => {
      expect(calculateDiscount(500, 'PERCENTAGE', 0)).toBe(0)
    })

    it('handles fractional percentages', () => {
      expect(calculateDiscount(1000, 'PERCENTAGE', 12.5)).toBe(125)
    })

    it('throws INVALID_DISCOUNT_PERCENTAGE when value is negative', () => {
      expect(() => calculateDiscount(1000, 'PERCENTAGE', -10)).toThrow(
        'INVALID_DISCOUNT_PERCENTAGE'
      )
    })

    it('throws INVALID_DISCOUNT_PERCENTAGE when value exceeds 100', () => {
      expect(() => calculateDiscount(1000, 'PERCENTAGE', 150)).toThrow(
        'INVALID_DISCOUNT_PERCENTAGE'
      )
    })
  })

  describe('invalid discount type', () => {
    it('throws INVALID_DISCOUNT_TYPE for unrecognized type', () => {
      expect(() =>
        calculateDiscount(1000, 'BOGUS' as any, 10)
      ).toThrow('INVALID_DISCOUNT_TYPE')
    })
  })
})