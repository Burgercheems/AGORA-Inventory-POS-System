import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import api from '../../services/api'

// ── design tokens ────────────────────────────────────────────────────────────
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
const INDIGO = '#818cf8'
const INDIGO_DIM = 'rgba(129,140,248,0.12)'
const CYAN = '#38bdf8'
const CYAN_DIM = 'rgba(56,189,248,0.12)'

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

const peso = (v: number) =>
  `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type Period = 'daily' | 'weekly' | 'monthly'

interface SalesDataPoint { label: string; revenue: number; orders: number }
interface BestSeller { product_id: string; name: string; qty: number; revenue: number }
interface RevenueStats { total_revenue: number; total_orders: number; avg_order_value: number; period: string }

// ── chart tooltip ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: BG_BASE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ color: TEXT_SECONDARY, fontSize: 12, marginBottom: 6, margin: '0 0 6px' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, fontSize: 13, fontWeight: 600, margin: '2px 0' }}>
          {p.name === 'revenue' ? peso(p.value) : `${p.value} orders`}
        </p>
      ))}
    </div>
  )
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('daily')

  // ── Sales chart data ──────────────────────────────────────────────────────
  const { data: salesData = [], isLoading: salesLoading } = useQuery<SalesDataPoint[]>({
    queryKey: ['reports-sales', period],
    queryFn: async () => {
      const res = await api.get('/reports/sales', { params: { period } })
      const raw = res.data?.data ?? res.data ?? []
      return Array.isArray(raw) ? raw : []
    },
  })

  // ── Best sellers ──────────────────────────────────────────────────────────
  const { data: bestSellers = [], isLoading: sellersLoading } = useQuery<BestSeller[]>({
    queryKey: ['reports-best-sellers'],
    queryFn: async () => {
      const res = await api.get('/reports/best-sellers')
      const raw = res.data?.data ?? res.data ?? []
      return Array.isArray(raw) ? raw : []
    },
  })

  // ── Revenue summary ───────────────────────────────────────────────────────
  const { data: revenue } = useQuery<RevenueStats>({
    queryKey: ['reports-revenue', period],
    queryFn: async () => {
      const res = await api.get('/reports/revenue', { params: { period } })
      return res.data?.data ?? res.data ?? {}
    },
  })

  // ── Inventory movement ────────────────────────────────────────────────────
  const { data: invMovement = [], isLoading: invLoading } = useQuery<any[]>({
    queryKey: ['reports-inventory', period],
    queryFn: async () => {
      const res = await api.get('/reports/inventory-movement', { params: { period } })
      const raw = res.data?.data ?? res.data ?? []
      return Array.isArray(raw) ? raw : []
    },
  })

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ]

  const kpis = [
    {
      label: 'Total Revenue',
      value: peso(revenue?.total_revenue ?? 0),
      sub: `${period} period`,
      accent: ACCENT,
      dim: ACCENT_DIM,
      icon: '₱',
    },
    {
      label: 'Total Orders',
      value: String(revenue?.total_orders ?? 0),
      sub: 'Completed transactions',
      accent: INDIGO,
      dim: INDIGO_DIM,
      icon: '🧾',
    },
    {
      label: 'Avg Order Value',
      value: peso(revenue?.avg_order_value ?? 0),
      sub: 'Per transaction',
      accent: SUCCESS,
      dim: SUCCESS_DIM,
      icon: '📊',
    },
    {
      label: 'Top Product',
      value: bestSellers[0]?.name?.split(' ').slice(0, 2).join(' ') ?? '—',
      sub: bestSellers[0] ? `${bestSellers[0].qty} units sold` : 'No data yet',
      accent: CYAN,
      dim: CYAN_DIM,
      icon: '🏆',
    },
  ]

  const thStyle: React.CSSProperties = {
    padding: '12px 20px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 700,
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    background: BG_BASE,
  }

  const tdStyle: React.CSSProperties = {
    padding: '14px 20px',
    fontSize: 13,
    borderTop: `1px solid ${BORDER}`,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header + period toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ color: TEXT_PRIMARY, fontSize: 22, fontWeight: 700, margin: 0 }}>Reports & Analytics</h1>
          <p style={{ color: TEXT_MUTED, fontSize: 13, marginTop: 4 }}>Business performance overview</p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 4 }}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                padding: '7px 16px',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: period === p.key ? ACCENT : 'transparent',
                color: period === p.key ? '#fff' : TEXT_MUTED,
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} style={card({ padding: 20 })}>
            <div style={labelStyle}>{kpi.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: kpi.accent, lineHeight: 1.2, marginBottom: 6 }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 12, color: TEXT_MUTED }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Sales Chart + Best Sellers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>

        {/* Revenue line chart */}
        <div style={card({ padding: 24 })}>
          <div style={{ marginBottom: 20 }}>
            <div style={labelStyle}>Sales Overview</div>
            <div style={{ color: TEXT_PRIMARY, fontSize: 20, fontWeight: 700 }}>
              {salesLoading ? '…' : peso(salesData.reduce((s, d) => s + Number(d.revenue), 0))}
            </div>
            <div style={{ color: TEXT_MUTED, fontSize: 12, marginTop: 2 }}>
              Total for selected period
            </div>
          </div>
          {salesLoading ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_MUTED, fontSize: 13 }}>
              Loading…
            </div>
          ) : salesData.length === 0 ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_MUTED, fontSize: 13 }}>
              No sales data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: TEXT_MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: TEXT_MUTED, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="revenue" stroke={ACCENT} strokeWidth={2.5} dot={{ fill: ACCENT, r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Best Sellers */}
        <div style={card({ padding: 0, overflow: 'hidden' })}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
            <div style={labelStyle}>Top Selling Products</div>
            <div style={{ color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600 }}>Best performers</div>
          </div>
          {sellersLoading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>Loading…</div>
          ) : bestSellers.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>
              No sales data yet
            </div>
          ) : (
            bestSellers.slice(0, 7).map((p, i) => (
              <div key={p.product_id ?? i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: 6, background: i === 0 ? ACCENT_DIM : INDIGO_DIM,
                    color: i === 0 ? ACCENT : INDIGO, fontSize: 11, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {i + 1}
                  </span>
                  <div>
                    <div style={{ color: TEXT_PRIMARY, fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{p.name}</div>
                    <div style={{ color: TEXT_MUTED, fontSize: 11, marginTop: 2 }}>{p.qty} units</div>
                  </div>
                </div>
                <div style={{ color: ACCENT, fontSize: 13, fontWeight: 700 }}>{peso(p.revenue)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Inventory Movement Chart */}
      <div style={card({ padding: 24 })}>
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={labelStyle}>Inventory Movement</div>
            <div style={{ color: TEXT_PRIMARY, fontSize: 16, fontWeight: 600 }}>Stock In vs Stock Out</div>
            <div style={{ color: TEXT_MUTED, fontSize: 12, marginTop: 2 }}>Units moved over selected period</div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { color: SUCCESS, label: 'Stock In' },
              { color: '#f87171', label: 'Stock Out' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />
                <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        {invLoading ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_MUTED, fontSize: 13 }}>Loading…</div>
        ) : invMovement.length === 0 ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_MUTED, fontSize: 13 }}>
            No inventory movement data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={invMovement} barSize={20} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: TEXT_MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: TEXT_MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="stock_in" name="Stock In" fill={SUCCESS} radius={[4, 4, 0, 0]} />
              <Bar dataKey="stock_out" name="Stock Out" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Orders table summary */}
      <div style={card({ overflow: 'hidden', padding: 0 })}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={labelStyle}>Sales Breakdown</div>
            <div style={{ color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600 }}>Revenue by period</div>
          </div>
          <span style={{ background: ACCENT_DIM, color: ACCENT, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </span>
        </div>
        {salesLoading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Period', 'Orders', 'Revenue', 'Avg Order Value'].map((h, i) => (
                  <th key={h} style={{ ...thStyle, textAlign: i >= 1 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
  {salesData.length === 0 ? (
    <tr>
      <td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>
        No data for this period
      </td>
    </tr>
  ) : (
    salesData.map((row, i) => (
      <tr key={i}
        onMouseEnter={(e) => (e.currentTarget.style.background = BG_BASE)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
        <td style={{ ...tdStyle, color: TEXT_PRIMARY, fontWeight: 600 }}>{row.label}</td>
        <td style={{ ...tdStyle, color: TEXT_SECONDARY, textAlign: 'right' }}>{row.orders ?? 0}</td>
        <td style={{ ...tdStyle, color: ACCENT, fontWeight: 700, textAlign: 'right' }}>{peso(row.revenue ?? 0)}</td>
        <td style={{ ...tdStyle, color: TEXT_SECONDARY, textAlign: 'right' }}>
          {row.orders ? peso((row.revenue ?? 0) / row.orders) : '—'}
        </td>
      </tr>
    ))
  )}
</tbody>
          </table>
        )}
      </div>

    </div>
  )
}