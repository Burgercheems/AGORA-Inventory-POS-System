import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

interface Product {
  id: string
  name: string
  sku: string
  barcode: string
  price: number
  status: string
  stock_levels?: { quantity: number }
  categories?: { name: string }
}

interface CartItem {
  product: Product
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
  order_items?: { product: Product; quantity: number; unit_price: number }[]
}

type DiscountType = 'flat' | 'percentage'
type ActiveTab = 'pos' | 'history'

export default function OrdersPage() {
  const queryClient = useQueryClient()

  // Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos')

  // POS State
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [discountType, setDiscountType] = useState<DiscountType>('flat')
  const [discountValue, setDiscountValue] = useState<number>(0)
  const [showReceipt, setShowReceipt] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null)
  const [amountPaid, setAmountPaid] = useState<number>(0)
  const [showPayment, setShowPayment] = useState(false)

  // Order History State
  const [historySearch, setHistorySearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showOrderDetail, setShowOrderDetail] = useState(false)

  // Fetch products for POS
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products', search],
    queryFn: async () => {
      const res = await api.get('/products', { params: { search, status: 'active' } })
      return res.data
    },
  })

  // Fetch order history
  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['orders', historySearch],
    queryFn: async () => {
      const res = await api.get('/orders', { params: { search: historySearch } })
      return res.data
    },
    enabled: activeTab === 'history',
  })

  // Create order mutation
  const createOrder = useMutation({
    mutationFn: async (payload: object) => {
      const res = await api.post('/orders', payload)
      return res.data
    },
    onSuccess: (data) => {
      setCompletedOrder(data)
      setShowPayment(false)
      setShowReceipt(true)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['stock'] })
    },
  })

  // Cart helpers
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { product, quantity: 1, unit_price: product.price }]
    })
  }

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId))
    } else {
      setCart((prev) =>
        prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
      )
    }
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
      discount: discountAmount,
      discount_type: discountType,
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

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order)
    setShowOrderDetail(true)
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">Point of Sale &amp; Order History</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('pos')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'pos'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            POS
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Order History
          </button>
        </div>
      </div>

      {/* POS Tab */}
      {activeTab === 'pos' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Product Panel */}
          <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name or SKU..."
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
            />
            <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
              {products.map((product) => {
                const stock = product.stock_levels?.quantity ?? 0
                const outOfStock = stock <= 0
                return (
                  <button
                    key={product.id}
                    onClick={() => !outOfStock && addToCart(product)}
                    disabled={outOfStock}
                    className={`bg-white border rounded-xl p-4 text-left transition-all ${
                      outOfStock
                        ? 'border-slate-200 opacity-50 cursor-not-allowed'
                        : 'border-slate-200 hover:border-amber-400 hover:shadow-md cursor-pointer'
                    }`}
                  >
                    <div className="text-xs text-slate-400 mb-1">
                      {product.categories?.name ?? 'Uncategorized'}
                    </div>
                    <div className="font-medium text-slate-800 text-sm leading-tight mb-2">
                      {product.name}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-amber-600 font-semibold text-sm">
                        ₱{product.price.toFixed(2)}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          outOfStock
                            ? 'bg-red-100 text-red-600'
                            : stock <= 5
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {outOfStock ? 'Out' : `${stock} left`}
                      </span>
                    </div>
                  </button>
                )
              })}
              {products.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400">
                  <span className="text-4xl mb-3">📦</span>
                  <p className="text-sm">No products found</p>
                </div>
              )}
            </div>
          </div>

          {/* Cart Panel */}
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-700">Cart</h2>
              <p className="text-xs text-slate-400">{cart.length} item(s)</p>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-slate-300">
                  <span className="text-4xl mb-2">🛒</span>
                  <p className="text-sm">Cart is empty</p>
                </div>
              )}
              {cart.map((item) => (
                <div key={item.product.id} className="bg-slate-50 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium text-slate-700 leading-tight flex-1 pr-2">
                      {item.product.name}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-slate-300 hover:text-red-400 text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(item.product.id, item.quantity - 1)}
                        className="w-6 h-6 rounded bg-slate-200 text-slate-600 text-sm hover:bg-slate-300 flex items-center justify-center"
                      >
                        −
                      </button>
                      <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.product.id, item.quantity + 1)}
                        className="w-6 h-6 rounded bg-slate-200 text-slate-600 text-sm hover:bg-slate-300 flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-amber-600">
                      ₱{(item.unit_price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Discount + Totals */}
            <div className="border-t border-slate-100 p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Discount</label>
                <div className="flex gap-2">
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="flat">₱ Flat</option>
                    <option value="percentage">% Off</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>₱{subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>−₱{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-slate-800 text-base pt-1 border-t border-slate-100">
                  <span>Total</span>
                  <span className="text-amber-600">₱{total.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                Proceed to Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order History Tab */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto">
            <div className="mb-4">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search orders..."
                className="w-full max-w-sm border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Order ID</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Total</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        #{order.id.slice(-8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(order.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-amber-600">
                        ₱{order.total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            order.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : order.status === 'cancelled'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleViewOrder(order)}
                          className="text-amber-600 hover:text-amber-700 text-sm font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-sm">
                        No orders found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Payment</h2>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Total Amount</span>
                <span className="font-bold text-slate-800 text-base">₱{total.toFixed(2)}</span>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600 block mb-1">
                  Amount Paid
                </label>
                <input
                  type="number"
                  min={0}
                  value={amountPaid || ''}
                  onChange={(e) => setAmountPaid(Number(e.target.value))}
                  placeholder="Enter amount"
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none text-right text-lg font-semibold"
                  autoFocus
                />
              </div>
              {amountPaid >= total && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex justify-between items-center">
                  <span className="text-sm text-green-700">Change</span>
                  <span className="font-bold text-green-700 text-lg">₱{change.toFixed(2)}</span>
                </div>
              )}
              {amountPaid > 0 && amountPaid < total && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-red-600">
                    Insufficient — need ₱{(total - amountPaid).toFixed(2)} more
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPayment(false)}
                className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2.5 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={amountPaid < total || createOrder.isPending}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                {createOrder.isPending ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && completedOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-2xl">✓</span>
              </div>
              <h2 className="text-lg font-semibold text-slate-800">Payment Received</h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                #{completedOrder.id.slice(-8).toUpperCase()}
              </p>
            </div>

            <div className="border-t border-dashed border-slate-200 py-4 space-y-2">
              {completedOrder.order_items?.map((item, i) => (
                <div key={i} className="flex justify-between text-sm text-slate-600">
                  <span>
                    {item.product.name} × {item.quantity}
                  </span>
                  <span>₱{(item.unit_price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-slate-200 pt-3 space-y-1 text-sm">
              {completedOrder.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>−₱{completedOrder.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-800 text-base">
                <span>Total</span>
                <span>₱{completedOrder.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Paid</span>
                <span>₱{amountPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-green-600">
                <span>Change</span>
                <span>₱{(amountPaid - completedOrder.total).toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 border border-slate-300 text-slate-600 rounded-lg py-2.5 text-sm hover:bg-slate-50"
              >
                Print
              </button>
              <button
                onClick={handleNewOrder}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                New Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {showOrderDetail && selectedOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Order Detail</h2>
                <p className="text-xs text-slate-400 font-mono">
                  #{selectedOrder.id.slice(-8).toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setShowOrderDetail(false)}
                className="text-slate-400 hover:text-slate-600 text-xl"
              >
                ×
              </button>
            </div>
            <div className="space-y-2 text-sm border-t border-slate-100 pt-4">
              <div className="flex justify-between text-slate-500">
                <span>Date</span>
                <span>{new Date(selectedOrder.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Status</span>
                <span
                  className={`font-medium ${
                    selectedOrder.status === 'completed' ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {selectedOrder.status}
                </span>
              </div>
            </div>
            {selectedOrder.order_items && selectedOrder.order_items.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Items</p>
                {selectedOrder.order_items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm text-slate-700">
                    <span>
                      {item.product.name} × {item.quantity}
                    </span>
                    <span>₱{(item.unit_price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 border-t border-slate-100 pt-4 space-y-1 text-sm">
              {selectedOrder.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>−₱{selectedOrder.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-800 text-base">
                <span>Total</span>
                <span>₱{selectedOrder.total.toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={() => setShowOrderDetail(false)}
              className="mt-5 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg py-2.5 text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}