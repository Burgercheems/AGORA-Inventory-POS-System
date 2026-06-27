import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import api from '../../services/api'
import { useAuthStore } from '../../stores/useAuthStore'

const peso = (v: number) =>
  `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface Order {
  id: string
  status: string
  total: number
  discount: number
  created_at: string
  cashier?: { name: string }
  items?: { product_id: string; quantity: number; unit_price: number; product?: { name: string } }[]
}

interface StockLevel {
  id: string
  quantity: number
  low_stock_threshold: number
  product: { id: string; name: string; sku: string }
}

// ── small helpers ────────────────────────────────────────────────────────────
const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '12px',
  padding: '20px',
  ...extra,
})

const label: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#64748b',
  marginBottom: '6px',
}

// ── chart tooltip ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label: lbl }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>{lbl}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, fontSize: 13, fontWeight: 600 }}>
          {p.name}: {peso(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [orders, setOrders] = useState<Order[]>([])
  const [recentOrders, setRecentOrders] = useState<Order[]>([])// add this new state
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([])
  const [totalProducts, setTotalProducts] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

   

  useEffect(() => {
    async function load() {
      try {

        const [todayOrdersRes, recentRes, stockRes, productsRes] = await Promise.all([
          api.get(`/orders?status=COMPLETED&limit=200`), // for stats + chart
          api.get('/orders?limit=6'),                                   // for recent panel
          api.get('/stock/levels?limit=50'),                            // paginated
          api.get('/products?limit=1'),                                 // just need count
        ])

        const todayOrders: Order[] = todayOrdersRes.data?.data ?? todayOrdersRes.data ?? []
        const recent: Order[] = recentRes.data?.data ?? recentRes.data ?? []
        const s: StockLevel[] = Array.isArray(stockRes.data) ? stockRes.data : stockRes.data?.data ?? []

        setOrders(todayOrders)       // used for: todaySales, chart, topProducts
        setRecentOrders(recent)      // used for: recent orders panel
        setStockLevels(s)
        const p = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data ?? []
setTotalProducts(productsRes.data?.total ?? p.length)      // total count comes from pagination meta
      } catch {
        setError('Failed to load dashboard data.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── derived stats ───────────────────────────────────────────────────────────
  
  const todayCompleted = orders
  const todaySales = todayCompleted.reduce((s, o) => s + Number(o.total), 0)
  const lowStock = stockLevels.filter((s) => s.quantity <= s.low_stock_threshold)

  // ── last 7 days chart data ──────────────────────────────────────────────────
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const label = d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
    const ds = d.toDateString()
    const revenue = orders
      .filter((o) => o.status === 'COMPLETED' && new Date(o.created_at).toDateString() === ds)
      .reduce((s, o) => s + Number(o.total), 0)
    return { label, Revenue: revenue }
  })

  // ── top selling products ────────────────────────────────────────────────────
  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {}
  orders
    .filter((o) => o.status === 'COMPLETED')
    .forEach((o) => {
      o.items?.forEach((item) => {
        const name = item.product?.name ?? item.product_id
        if (!productSales[item.product_id]) {
          productSales[item.product_id] = { name, qty: 0, revenue: 0 }
        }
        productSales[item.product_id].qty += item.quantity
        productSales[item.product_id].revenue += Number(item.unit_price) * item.quantity
      })
    })
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #f59e0b', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 24, textAlign: 'center', color: '#f87171' }}>
        {error}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div>
        <h1 style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700, margin: 0 }}>
          {greeting()}, {user?.name?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>
          {new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: "Today's Sales", value: peso(todaySales), sub: 'Completed orders today', accent: '#f59e0b', icon: '₱' },
          { label: 'Orders Today', value: String(todayCompleted.length), sub: 'Completed transactions', accent: '#818cf8', icon: '🧾' },
          { label: 'Low Stock', value: String(lowStock.length), sub: 'Items below threshold', accent: lowStock.length > 0 ? '#f87171' : '#34d399', icon: '⚠️' },
          { label: 'Total Products', value: String(totalProducts), sub: 'In catalog', accent: '#38bdf8', icon: '📦' },
        ].map((kpi) => (
          <div key={kpi.label} style={card()}>
            <div style={label}>{kpi.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: kpi.accent, lineHeight: 1.1 }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Chart + Recent Orders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>

        {/* Sales Chart */}
        <div style={card()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={label}>Sales Overview</div>
              <div style={{ color: '#f1f5f9', fontSize: 22, fontWeight: 700 }}>
                {peso(orders.filter(o => o.status === 'COMPLETED').reduce((s, o) => s + Number(o.total), 0))}
              </div>
              <div style={{ color: '#475569', fontSize: 12 }}>All time revenue</div>
            </div>
            <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
              Last 7 Days
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Revenue" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Orders */}
        <div style={card({ padding: 0, overflow: 'hidden' })}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #334155' }}>
            <span style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>Recent Orders</span>
            <button
              onClick={() => navigate('/orders')}
              style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
            >
              View all →
            </button>
          </div>
          <div>
            {recentOrders.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#475569', fontSize: 13 }}>No orders yet.</div>
            ) : (
              recentOrders.map((o) => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #1e293b' }}>
                  <div>
                    <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>#{o.id.slice(-6).toUpperCase()}</div>
                    <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>
                      {o.cashier?.name ?? 'Cashier'} · {new Date(o.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700 }}>{peso(Number(o.total))}</div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, marginTop: 3, display: 'inline-block',
                      background: o.status === 'COMPLETED' ? 'rgba(52,211,153,0.12)' : o.status === 'VOIDED' ? 'rgba(248,113,113,0.12)' : 'rgba(245,158,11,0.12)',
                      color: o.status === 'COMPLETED' ? '#34d399' : o.status === 'VOIDED' ? '#f87171' : '#f59e0b',
                    }}>
                      {o.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Products + Low Stock */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Top Selling Products */}
        <div style={card({ padding: 0, overflow: 'hidden' })}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155' }}>
            <span style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>Top Selling Products</span>
          </div>
          {topProducts.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 13 }}>
              No sales data yet. Process some orders to see top products.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  {['Product', 'Units Sold', 'Revenue'].map((h) => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: h === 'Product' ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #1e293b' }}>
                    <td style={{ padding: '12px 20px', color: '#e2e8f0', fontSize: 13 }}>{p.name}</td>
                    <td style={{ padding: '12px 20px', color: '#94a3b8', fontSize: 13, textAlign: 'right' }}>{p.qty}</td>
                    <td style={{ padding: '12px 20px', color: '#f59e0b', fontSize: 13, fontWeight: 700, textAlign: 'right' }}>{peso(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div style={card({ padding: 0, overflow: 'hidden' })}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #334155' }}>
            <span style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600 }}>Low Stock Alerts</span>
            <button
              onClick={() => navigate('/stock')}
              style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
            >
              Manage →
            </button>
          </div>
          {lowStock.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#34d399', fontSize: 13 }}>
              ✓ All stock levels are healthy
            </div>
          ) : (
            lowStock.slice(0, 6).map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #1e293b' }}>
                <div>
                  <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500 }}>{s.product.name}</div>
                  <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>{s.product.sku}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#f87171', fontSize: 15, fontWeight: 800 }}>{s.quantity}</div>
                  <div style={{ color: '#475569', fontSize: 11 }}>min {s.low_stock_threshold}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}