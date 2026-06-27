import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'
import CameraScanner from '../../components/CameraScanner'

interface Product {
  id: string
  name: string
  sku: string
  barcode: string
  price: number
  status: string
  stock_level?: { quantity: number }
  category?: { name: string }
}

interface CartItem {
  product: Product
  quantity: number
  unit_price: number
}

// FIX: order_items uses 'items' relation name from backend include
interface OrderItem {
  product: { id: string; name: string; sku?: string }
  quantity: number
  unit_price: number
}

interface Order {
  id: string
  cashier_id: string
  total: number
  discount: number
  status: string
  created_at: string
  cashier?: { name: string }
  items?: OrderItem[]        // used in receipt response (createOrder returns this)
  order_items?: OrderItem[]  // used in history list (getOrders returns this key via Prisma alias)
  transaction?: {
    amount_paid: number
    change: number
    payment_method: string
  } | null
}

type DiscountType = 'flat' | 'percentage'
type ActiveTab = 'pos' | 'history'

// ── design tokens ─────────────────────────────────────────────────────────────
const BG_BASE = '#0f172a'
const BG_CARD = '#1e293b'
const BORDER = '#334155'
const TEXT_PRIMARY = '#f1f5f9'
const TEXT_SECONDARY = '#94a3b8'
const TEXT_MUTED = '#475569'
const ACCENT = '#f59e0b'
const ACCENT_DIM = 'rgba(245,158,11,0.12)'
const SUCCESS = '#34d399'
const SUCCESS_DIM = 'rgba(52,211,153,0.12)'
const DANGER = '#f87171'
const DANGER_DIM = 'rgba(248,113,113,0.12)'

const peso = (v: number) =>
  `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: BG_CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: '12px',
  ...extra,
})

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: TEXT_MUTED,
  marginBottom: '6px',
}

export default function OrdersPage() {
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<ActiveTab>('pos')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [discountType, setDiscountType] = useState<DiscountType>('flat')
  const [discountValue, setDiscountValue] = useState<number>(0)
  const [showReceipt, setShowReceipt] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null)
  const [amountPaid, setAmountPaid] = useState<number>(0)
  const [showPayment, setShowPayment] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showOrderDetail, setShowOrderDetail] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products', search],
    queryFn: async () => {
      const res = await api.get('/products', { params: { search, status: 'ACTIVE' } })
      return res.data?.data ?? res.data ?? []
    },
  })

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['orders', historySearch],
    queryFn: async () => {
      const res = await api.get('/orders', { params: { search: historySearch } })
      return res.data?.data ?? res.data ?? []
    },
    enabled: activeTab === 'history',
  })

  const createOrder = useMutation({
    mutationFn: async (payload: object) => {
      const res = await api.post('/orders', payload)
      return res.data as Order
    },
    onSuccess: (data) => {
      // FIX: store the full order returned by the backend (now includes product names + transaction)
      setCompletedOrder(data)
      setShowPayment(false)
      setShowReceipt(true)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing)
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      return [...prev, { product, quantity: 1, unit_price: product.price }]
    })
  }

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) setCart((prev) => prev.filter((i) => i.product.id !== productId))
    else
      setCart((prev) =>
        prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
      )
  }

  const removeFromCart = (productId: string) =>
    setCart((prev) => prev.filter((i) => i.product.id !== productId))

  const subtotal = cart.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const discountAmount =
    discountType === 'flat' ? discountValue : (subtotal * discountValue) / 100
  const total = Math.max(0, subtotal - discountAmount)
  const change = amountPaid - total

  const handleCheckout = () => {
    if (cart.length === 0) return
    setAmountPaid(0)
    setShowPayment(true)
  }

  const handleConfirmPayment = () => {
    if (amountPaid < total) return
    createOrder.mutate({
      items: cart.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
      // FIX: send uppercase discount_type so backend calculateDiscount receives correct enum value
      discount_type: discountType.toUpperCase(),
      discount_value: discountValue,
      total,
      amount_paid: amountPaid,
      payment_method: 'cash',
    })
  }

  const handleNewOrder = () => {
    setCart([])
    setDiscountValue(0)
    setDiscountType('flat')
    setShowReceipt(false)
    setCompletedOrder(null)
    setAmountPaid(0)
  }

  const statusColors = (status: string) => {
    if (status === 'COMPLETED' || status === 'completed')
      return { bg: SUCCESS_DIM, color: SUCCESS }
    if (status === 'VOIDED' || status === 'cancelled')
      return { bg: DANGER_DIM, color: DANGER }
    return { bg: ACCENT_DIM, color: ACCENT }
  }

  // Helper: get items from an order regardless of which key the backend used
  const getOrderItems = (order: Order): OrderItem[] =>
    order.items ?? order.order_items ?? []

  // FIX: receipt amount_paid — prefer transaction record, fall back to local state
  const receiptAmountPaid =
    completedOrder?.transaction?.amount_paid ?? amountPaid
  const receiptChange =
    completedOrder?.transaction?.change ?? (amountPaid - (completedOrder?.total ?? 0))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%', minHeight: 0 }}>

      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ color: TEXT_PRIMARY, fontSize: 22, fontWeight: 700, margin: 0 }}>Orders</h1>
          <p style={{ color: TEXT_MUTED, fontSize: 13, marginTop: 4 }}>
            Point of Sale &amp; Order History
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['pos', 'history'] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === tab ? ACCENT : BG_CARD,
                color: activeTab === tab ? '#fff' : TEXT_SECONDARY,
                transition: 'all 0.15s',
              }}
            >
              {tab === 'pos' ? 'POS' : 'Order History'}
            </button>
          ))}
        </div>
      </div>

      {/* ── POS Tab ── */}
      {activeTab === 'pos' && (
        <div
          style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, overflow: 'hidden' }}
        >
          {/* Product Grid */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minHeight: 0,
            }}
          >
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
  <input
    type="text"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    placeholder="Search products by name or SKU…"
    style={{
      flex: 1,
      background: BG_CARD,
      border: `1px solid ${BORDER}`,
      borderRadius: 8,
      padding: '10px 14px',
      color: TEXT_PRIMARY,
      fontSize: 13,
      outline: 'none',
    }}
  />
  <button
    onClick={() => setShowScanner(true)}
    style={{
      background: ACCENT_DIM,
      border: `1px solid ${ACCENT}`,
      borderRadius: 8,
      padding: '10px 16px',
      color: ACCENT,
      fontSize: 13,
      fontWeight: 700,
      cursor: 'pointer',
      flexShrink: 0,
    }}
  >
    📷 Scan
  </button>
</div>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 12,
                alignContent: 'start',
              }}
            >
              {products.map((product) => {
                const stock = product.stock_level?.quantity ?? 0
                const outOfStock = stock <= 0
                return (
                  <button
                    key={product.id}
                    onClick={() => !outOfStock && addToCart(product)}
                    disabled={outOfStock}
                    style={{
                      ...card({
                        padding: 16,
                        textAlign: 'left',
                        cursor: outOfStock ? 'not-allowed' : 'pointer',
                        opacity: outOfStock ? 0.45 : 1,
                        transition: 'border-color 0.15s',
                      }),
                      background: BG_CARD,
                    }}
                    onMouseEnter={(e) => {
                      if (!outOfStock) e.currentTarget.style.borderColor = ACCENT
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = BORDER
                    }}
                  >
                    <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 4 }}>
                      {product.category?.name ?? 'Uncategorized'}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: TEXT_PRIMARY,
                        lineHeight: 1.3,
                        marginBottom: 10,
                      }}
                    >
                      {product.name}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ color: ACCENT, fontWeight: 700, fontSize: 13 }}>
                        {peso(product.price)}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 20,
                          background: outOfStock
                            ? DANGER_DIM
                            : stock <= 5
                            ? ACCENT_DIM
                            : SUCCESS_DIM,
                          color: outOfStock ? DANGER : stock <= 5 ? ACCENT : SUCCESS,
                        }}
                      >
                        {outOfStock ? 'Out' : `${stock} left`}
                      </span>
                    </div>
                  </button>
                )
              })}
              {products.length === 0 && (
                <div
                  style={{
                    gridColumn: '1/-1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '60px 0',
                    color: TEXT_MUTED,
                  }}
                >
                  <span style={{ fontSize: 36, marginBottom: 10 }}>📦</span>
                  <p style={{ fontSize: 13 }}>No products found</p>
                </div>
              )}
            </div>
          </div>

          {/* Cart Panel */}
          <div
            style={card({
              display: 'flex',
              flexDirection: 'column',
              width: 300,
              flexShrink: 0,
              overflow: 'hidden',
              padding: 0,
            })}
          >
            <div
              style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}
            >
              <div style={{ color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600 }}>Cart</div>
              <div style={{ color: TEXT_MUTED, fontSize: 12, marginTop: 2 }}>
                {cart.length} item(s)
              </div>
            </div>

            {/* Items */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {cart.length === 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 140,
                    color: TEXT_MUTED,
                  }}
                >
                  <span style={{ fontSize: 32, marginBottom: 8 }}>🛒</span>
                  <p style={{ fontSize: 12 }}>Cart is empty</p>
                </div>
              )}
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  style={{ background: BG_BASE, borderRadius: 8, padding: 12 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: TEXT_PRIMARY,
                        flex: 1,
                        paddingRight: 8,
                        lineHeight: 1.3,
                      }}
                    >
                      {item.product.name}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: TEXT_MUTED,
                        fontSize: 16,
                        cursor: 'pointer',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {([-1, null, 1] as (number | null)[]).map((delta, idx) =>
                        delta === null ? (
                          <span
                            key="qty"
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: TEXT_PRIMARY,
                              width: 20,
                              textAlign: 'center',
                            }}
                          >
                            {item.quantity}
                          </span>
                        ) : (
                          <button
                            key={idx}
                            onClick={() =>
                              updateQty(item.product.id, item.quantity + (delta as number))
                            }
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 6,
                              border: `1px solid ${BORDER}`,
                              background: BG_CARD,
                              color: TEXT_SECONDARY,
                              fontSize: 14,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {delta === -1 ? '−' : '+'}
                          </button>
                        )
                      )}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>
                      {peso(item.unit_price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Discount + Totals */}
            <div
              style={{
                borderTop: `1px solid ${BORDER}`,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div>
                <div style={labelStyle}>Discount</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                    style={{
                      background: BG_BASE,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                      padding: '8px 10px',
                      color: TEXT_PRIMARY,
                      fontSize: 12,
                      outline: 'none',
                    }}
                  >
                    <option value="flat">₱ Flat</option>
                    <option value="percentage">% Off</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    style={{
                      flex: 1,
                      background: BG_BASE,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                      padding: '8px 12px',
                      color: TEXT_PRIMARY,
                      fontSize: 13,
                      outline: 'none',
                    }}
                    placeholder="0"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', color: TEXT_MUTED }}
                >
                  <span>Subtotal</span>
                  <span>{peso(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', color: SUCCESS }}
                  >
                    <span>Discount</span>
                    <span>−{peso(discountAmount)}</span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: TEXT_PRIMARY,
                    fontWeight: 700,
                    fontSize: 15,
                    paddingTop: 8,
                    borderTop: `1px solid ${BORDER}`,
                  }}
                >
                  <span>Total</span>
                  <span style={{ color: ACCENT }}>{peso(total)}</span>
                </div>
              </div>
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                style={{
                  background: cart.length === 0 ? BORDER : ACCENT,
                  color: cart.length === 0 ? TEXT_MUTED : '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                Proceed to Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Order History Tab ── */}
      {activeTab === 'history' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search orders…"
              style={{
                background: BG_CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: '10px 14px',
                color: TEXT_PRIMARY,
                fontSize: 13,
                outline: 'none',
                width: 280,
              }}
            />
          </div>
          <div style={card({ overflow: 'hidden', padding: 0 })}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: BG_BASE }}>
                  {['Order ID', 'Date', 'Cashier', 'Total', 'Status', ''].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 20px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 700,
                        color: TEXT_MUTED,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const sc = statusColors(order.status)
                  return (
                    <tr key={order.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td
                        style={{
                          padding: '14px 20px',
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: TEXT_SECONDARY,
                        }}
                      >
                        #{order.id.slice(-8).toUpperCase()}
                      </td>
                      <td style={{ padding: '14px 20px', color: TEXT_SECONDARY, fontSize: 13 }}>
                        {new Date(order.created_at).toLocaleString('en-PH')}
                      </td>
                      <td style={{ padding: '14px 20px', color: TEXT_SECONDARY, fontSize: 13 }}>
                        {order.cashier?.name ?? '—'}
                      </td>
                      <td
                        style={{
                          padding: '14px 20px',
                          color: ACCENT,
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {peso(order.total)}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 20,
                            background: sc.bg,
                            color: sc.color,
                          }}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <button
                          onClick={() => {
                            setSelectedOrder(order)
                            setShowOrderDetail(true)
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: ACCENT,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {orders.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: '48px',
                        textAlign: 'center',
                        color: TEXT_MUTED,
                        fontSize: 13,
                      }}
                    >
                      No orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Payment Modal ── */}
      {showPayment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div style={card({ padding: 28, width: '100%', maxWidth: 380 })}>
            <h2 style={{ color: TEXT_PRIMARY, fontSize: 18, fontWeight: 700, margin: '0 0 20px' }}>
              Payment
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: TEXT_SECONDARY }}
              >
                <span>Total Amount</span>
                <span style={{ fontWeight: 800, color: TEXT_PRIMARY, fontSize: 18 }}>
                  {peso(total)}
                </span>
              </div>
              <div>
                <div style={labelStyle}>Amount Paid</div>
                <input
                  type="number"
                  min={0}
                  value={amountPaid || ''}
                  onChange={(e) => setAmountPaid(Number(e.target.value))}
                  placeholder="Enter amount"
                  style={{
                    width: '100%',
                    background: BG_BASE,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 8,
                    padding: '12px 16px',
                    color: TEXT_PRIMARY,
                    fontSize: 20,
                    fontWeight: 700,
                    textAlign: 'right',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                />
              </div>
              {amountPaid >= total && amountPaid > 0 && (
                <div
                  style={{
                    background: SUCCESS_DIM,
                    border: `1px solid rgba(52,211,153,0.3)`,
                    borderRadius: 8,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: SUCCESS, fontSize: 13 }}>Change</span>
                  <span style={{ color: SUCCESS, fontWeight: 800, fontSize: 18 }}>
                    {peso(change)}
                  </span>
                </div>
              )}
              {amountPaid > 0 && amountPaid < total && (
                <div
                  style={{
                    background: DANGER_DIM,
                    border: `1px solid rgba(248,113,113,0.3)`,
                    borderRadius: 8,
                    padding: '12px 16px',
                  }}
                >
                  <p style={{ color: DANGER, fontSize: 13, margin: 0 }}>
                    Insufficient — need {peso(total - amountPaid)} more
                  </p>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowPayment(false)}
                style={{
                  flex: 1,
                  background: 'none',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: '12px',
                  color: TEXT_SECONDARY,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={amountPaid < total || createOrder.isPending}
                style={{
                  flex: 1,
                  background: amountPaid < total ? BORDER : ACCENT,
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: amountPaid < total ? 'not-allowed' : 'pointer',
                }}
              >
                {createOrder.isPending ? 'Processing…' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Receipt Modal ── */}
{showReceipt && completedOrder && (
  <div
    style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 50, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 16,
    }}
  >
    <div style={card({ padding: 28, width: '100%', maxWidth: 380 })}>

      {/* Store Header */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT, letterSpacing: '0.05em' }}>
          AGORA
        </div>
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
          Inventory &amp; POS System
        </div>
        <div style={{ marginTop: 12, width: 40, height: 40, borderRadius: '50%', background: SUCCESS_DIM,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '12px auto 6px', fontSize: 20 }}>
          ✓
        </div>
        <h2 style={{ color: TEXT_PRIMARY, fontSize: 16, fontWeight: 700, margin: '4px 0 0' }}>
          Payment Received
        </h2>
      </div>

      {/* Order meta */}
      <div style={{ borderTop: `1px dashed ${BORDER}`, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          { label: 'Order #', value: `#${completedOrder.id.slice(-8).toUpperCase()}` },
          { label: 'Date', value: new Date(completedOrder.created_at ?? Date.now()).toLocaleString('en-PH') },
          { label: 'Cashier', value: completedOrder.cashier?.name ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TEXT_MUTED }}>
            <span>{label}</span>
            <span style={{ color: TEXT_SECONDARY }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Items */}
      <div style={{ borderTop: `1px dashed ${BORDER}`, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {getOrderItems(completedOrder).map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: TEXT_SECONDARY }}>
            <span>{item.product.name} × {item.quantity}</span>
            <span>{peso(Number(item.unit_price) * item.quantity)}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div style={{ borderTop: `1px dashed ${BORDER}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {completedOrder.discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: SUCCESS }}>
            <span>Discount</span>
            <span>−{peso(completedOrder.discount)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: TEXT_PRIMARY }}>
          <span>Total</span>
          <span>{peso(completedOrder.total)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: TEXT_SECONDARY }}>
          <span>Paid</span>
          <span>{peso(receiptAmountPaid)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: SUCCESS }}>
          <span>Change</span>
          <span>{peso(receiptChange)}</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px dashed ${BORDER}`, marginTop: 14, paddingTop: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: TEXT_MUTED }}>Thank you for shopping!</div>
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>Please come again 🙂</div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
        <button
          onClick={() => window.print()}
          style={{ flex: 1, background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8,
            padding: '12px', color: TEXT_SECONDARY, fontSize: 13, cursor: 'pointer' }}>
          Print
        </button>
        <button
          onClick={handleNewOrder}
          style={{ flex: 1, background: ACCENT, border: 'none', borderRadius: 8,
            padding: '12px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          New Order
        </button>
      </div>
    </div>
  </div>
)}
      {/* ── Order Detail Modal ── */}
      {showOrderDetail && selectedOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div style={card({ padding: 28, width: '100%', maxWidth: 420 })}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 20,
              }}
            >
              <div>
                <h2 style={{ color: TEXT_PRIMARY, fontSize: 18, fontWeight: 700, margin: 0 }}>
                  Order Detail
                </h2>
                <p
                  style={{ color: TEXT_MUTED, fontSize: 11, fontFamily: 'monospace', marginTop: 4 }}
                >
                  #{selectedOrder.id.slice(-8).toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setShowOrderDetail(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: TEXT_MUTED,
                  fontSize: 20,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                borderTop: `1px solid ${BORDER}`,
                paddingTop: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {[
                { label: 'Date', value: new Date(selectedOrder.created_at).toLocaleString('en-PH') },
                { label: 'Cashier', value: selectedOrder.cashier?.name ?? '—' },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}
                >
                  <span style={{ color: TEXT_MUTED }}>{label}</span>
                  <span style={{ color: TEXT_SECONDARY }}>{value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: TEXT_MUTED }}>Status</span>
                <span
                  style={{
                    ...statusColors(selectedOrder.status),
                    fontWeight: 700,
                    padding: '2px 10px',
                    borderRadius: 20,
                    fontSize: 11,
                  }}
                >
                  {selectedOrder.status}
                </span>
              </div>
            </div>

            {/* FIX: use getOrderItems() for detail view too */}
            {getOrderItems(selectedOrder).length > 0 && (
              <div
                style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}
              >
                <div style={labelStyle}>Items</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {getOrderItems(selectedOrder).map((item, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13,
                        color: TEXT_SECONDARY,
                      }}
                    >
                      <span>
                        {item.product.name} × {item.quantity}
                      </span>
                      <span>{peso(Number(item.unit_price) * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: `1px solid ${BORDER}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {selectedOrder.discount > 0 && (
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: SUCCESS }}
                >
                  <span>Discount</span>
                  <span>−{peso(selectedOrder.discount)}</span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 16,
                  fontWeight: 800,
                  color: TEXT_PRIMARY,
                }}
              >
                <span>Total</span>
                <span style={{ color: ACCENT }}>{peso(selectedOrder.total)}</span>
              </div>
            </div>

            <button
              onClick={() => setShowOrderDetail(false)}
              style={{
                marginTop: 20,
                width: '100%',
                background: BG_BASE,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: '12px',
                color: TEXT_SECONDARY,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Camera Scanner Modal ── */}       ← ADD HERE
      {showScanner && (
        <CameraScanner
          onProductFound={(product) => {
            addToCart(product)
            setShowScanner(false)
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}