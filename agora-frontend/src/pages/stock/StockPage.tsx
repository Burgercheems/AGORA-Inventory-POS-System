import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../services/api'

interface StockLevel {
  id: string
  product_id: string
  quantity: number
  low_stock_threshold: number
  products: {
    id: string
    name: string
    sku: string
    categories?: { name: string }
  }
}

interface StockMovement {
  id: string
  product_id: string
  type: 'in' | 'out'
  quantity: number
  reason: string
  user_id: string
  created_at: string
  products?: { name: string; sku: string }
}

interface Product {
  id: string
  name: string
  sku: string
}

type ActiveTab = 'levels' | 'in' | 'out' | 'history'

export default function StockPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ActiveTab>('levels')

  // Stock Levels state
  const [levelsSearch, setLevelsSearch] = useState('')
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)

  // Stock In state
  const [inProductId, setInProductId] = useState('')
  const [inQuantity, setInQuantity] = useState<number>(0)
  const [inReason, setInReason] = useState('')
  const [inError, setInError] = useState('')
  const [inSuccess, setInSuccess] = useState(false)

  // Stock Out state
  const [outProductId, setOutProductId] = useState('')
  const [outQuantity, setOutQuantity] = useState<number>(0)
  const [outReason, setOutReason] = useState('')
  const [outError, setOutError] = useState('')
  const [outSuccess, setOutSuccess] = useState(false)

  // History state
  const [historySearch, setHistorySearch] = useState('')
  const [historyType, setHistoryType] = useState<'all' | 'in' | 'out'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Fetch stock levels
  const { data: stockLevels = [], isLoading: levelsLoading } = useQuery<StockLevel[]>({
    queryKey: ['stock-levels', levelsSearch, showLowStockOnly],
    queryFn: async () => {
      const res = await api.get('/stock/levels', {
        params: { search: levelsSearch, low_stock: showLowStockOnly || undefined },
      })
      return res.data
    },
  })

  // Fetch all products for dropdowns
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products-dropdown'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { status: 'active', limit: 500 } })
      return res.data
    },
  })

  // Fetch stock movements history
  const { data: movements = [], isLoading: movementsLoading } = useQuery<StockMovement[]>({
    queryKey: ['stock-movements', historySearch, historyType, dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get('/stock/movements', {
        params: {
          search: historySearch,
          type: historyType === 'all' ? undefined : historyType,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
      })
      return res.data
    },
    enabled: activeTab === 'history',
  })

  // Stock In mutation
  const stockInMutation = useMutation({
    mutationFn: async (payload: object) => {
      const res = await api.post('/stock/in', payload)
      return res.data
    },
    onSuccess: () => {
      setInSuccess(true)
      setInProductId('')
      setInQuantity(0)
      setInReason('')
      setInError('')
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      setTimeout(() => setInSuccess(false), 3000)
    },
    onError: (err: any) => {
      setInError(err?.response?.data?.message ?? 'Failed to record stock-in')
    },
  })

  // Stock Out mutation
  const stockOutMutation = useMutation({
    mutationFn: async (payload: object) => {
      const res = await api.post('/stock/out', payload)
      return res.data
    },
    onSuccess: () => {
      setOutSuccess(true)
      setOutProductId('')
      setOutQuantity(0)
      setOutReason('')
      setOutError('')
      queryClient.invalidateQueries({ queryKey: ['stock-levels'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      setTimeout(() => setOutSuccess(false), 3000)
    },
    onError: (err: any) => {
      setOutError(err?.response?.data?.message ?? 'Failed to record stock-out')
    },
  })

  const handleStockIn = () => {
    setInError('')
    if (!inProductId) return setInError('Please select a product')
    if (!inQuantity || inQuantity <= 0) return setInError('Quantity must be greater than 0')
    if (!inReason.trim()) return setInError('Reason is required')
    stockInMutation.mutate({ product_id: inProductId, quantity: inQuantity, reason: inReason })
  }

  const handleStockOut = () => {
    setOutError('')
    if (!outProductId) return setOutError('Please select a product')
    if (!outQuantity || outQuantity <= 0) return setOutError('Quantity must be greater than 0')
    if (!outReason.trim()) return setOutError('Reason is required')
    stockOutMutation.mutate({ product_id: outProductId, quantity: outQuantity, reason: outReason })
  }

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'levels', label: 'Stock Levels' },
    { key: 'in', label: 'Stock In' },
    { key: 'out', label: 'Stock Out' },
    { key: 'history', label: 'Movement History' },
  ]

  const lowStockCount = stockLevels.filter(
    (s) => s.quantity <= s.low_stock_threshold
  ).length

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Stock Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track inventory levels and movements</p>
        </div>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-600 font-medium">
              {lowStockCount} low stock {lowStockCount === 1 ? 'item' : 'items'}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto">

          {/* Stock Levels Tab */}
          {activeTab === 'levels' && (
            <div className="space-y-4">
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  value={levelsSearch}
                  onChange={(e) => setLevelsSearch(e.target.value)}
                  placeholder="Search products..."
                  className="border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none w-64"
                />
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLowStockOnly}
                    onChange={(e) => setShowLowStockOnly(e.target.checked)}
                    className="accent-amber-500"
                  />
                  Low stock only
                </label>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {levelsLoading ? (
                  <div className="py-16 text-center text-slate-400 text-sm">Loading...</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Product</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">SKU</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Quantity</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Threshold</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stockLevels.map((level) => {
                        const isLow = level.quantity <= level.low_stock_threshold
                        const isOut = level.quantity === 0
                        return (
                          <tr key={level.id} className={`hover:bg-slate-50 ${isLow ? 'bg-red-50/30' : ''}`}>
                            <td className="px-4 py-3 font-medium text-slate-700">
                              {level.products.name}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">
                              {level.products.sku}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {level.products.categories?.name ?? '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`font-semibold text-base ${
                                  isOut
                                    ? 'text-red-600'
                                    : isLow
                                    ? 'text-amber-600'
                                    : 'text-slate-800'
                                }`}
                              >
                                {level.quantity}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500">{level.low_stock_threshold}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  isOut
                                    ? 'bg-red-100 text-red-600'
                                    : isLow
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-green-100 text-green-700'
                                }`}
                              >
                                {isOut ? 'Out of stock' : isLow ? 'Low stock' : 'In stock'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                      {stockLevels.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">
                            No products found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Stock In Tab */}
          {activeTab === 'in' && (
            <div className="max-w-lg">
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600 font-bold">
                    +
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-800">Record Stock In</h2>
                    <p className="text-xs text-slate-400">Add new inventory from a supplier</p>
                  </div>
                </div>

                {inSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
                    ✓ Stock-in recorded successfully
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Product <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={inProductId}
                      onChange={(e) => setInProductId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.sku}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Quantity <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={inQuantity || ''}
                      onChange={(e) => setInQuantity(Number(e.target.value))}
                      placeholder="e.g. 50"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Reason / Source <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={inReason}
                      onChange={(e) => setInReason(e.target.value)}
                      placeholder="e.g. Delivery from Supplier ABC"
                      rows={3}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none resize-none"
                    />
                  </div>

                  {inError && (
                    <p className="text-sm text-red-500">{inError}</p>
                  )}

                  <button
                    onClick={handleStockIn}
                    disabled={stockInMutation.isPending}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
                  >
                    {stockInMutation.isPending ? 'Recording...' : 'Record Stock In'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stock Out Tab */}
          {activeTab === 'out' && (
            <div className="max-w-lg">
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-600 font-bold">
                    −
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-800">Record Stock Out</h2>
                    <p className="text-xs text-slate-400">Manually deduct stock (e.g. damage, loss)</p>
                  </div>
                </div>

                {outSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
                    ✓ Stock-out recorded successfully
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Product <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={outProductId}
                      onChange={(e) => setOutProductId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.sku}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Quantity <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={outQuantity || ''}
                      onChange={(e) => setOutQuantity(Number(e.target.value))}
                      placeholder="e.g. 5"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Reason <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={outReason}
                      onChange={(e) => setOutReason(e.target.value)}
                      placeholder="e.g. Damaged goods, expired items"
                      rows={3}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none resize-none"
                    />
                  </div>

                  {outError && (
                    <p className="text-sm text-red-500">{outError}</p>
                  )}

                  <button
                    onClick={handleStockOut}
                    disabled={stockOutMutation.isPending}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
                  >
                    {stockOutMutation.isPending ? 'Recording...' : 'Record Stock Out'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Movement History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search by product..."
                  className="border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none w-56"
                />
                <select
                  value={historyType}
                  onChange={(e) => setHistoryType(e.target.value as 'all' | 'in' | 'out')}
                  className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                >
                  <option value="all">All Types</option>
                  <option value="in">Stock In</option>
                  <option value="out">Stock Out</option>
                </select>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                />
                <span className="text-slate-400 text-sm">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {movementsLoading ? (
                  <div className="py-16 text-center text-slate-400 text-sm">Loading...</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Product</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">SKU</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Quantity</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Reason</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {movements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {m.products?.name ?? m.product_id}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">
                            {m.products?.sku ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                m.type === 'in'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-600'
                              }`}
                            >
                              {m.type === 'in' ? '↑ Stock In' : '↓ Stock Out'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{m.quantity}</td>
                          <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{m.reason}</td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {new Date(m.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {movements.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">
                            No movements found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}