import { useEffect } from 'react'
import { useStockStore } from '../../stores/useStockStore'

const DANGER  = '#f87171'
const DANGER_DIM = 'rgba(248,113,113,0.12)'
const ACCENT  = '#f59e0b'
const ACCENT_DIM = 'rgba(245,158,11,0.12)'
const BG_CARD = '#1e293b'
const TEXT_PRIMARY   = '#f1f5f9'
const TEXT_SECONDARY = '#94a3b8'
const TEXT_MUTED     = '#475569'

export default function Toast() {
  const { alerts, dismissAlert } = useStockStore()

  // auto-dismiss after 6 seconds
  useEffect(() => {
    if (alerts.length === 0) return
    const timer = setTimeout(() => {
      dismissAlert(alerts[alerts.length - 1].id)
    }, 6000)
    return () => clearTimeout(timer)
  }, [alerts])

  if (alerts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 320,
      }}
    >
      {alerts.map((alert) => {
        const critical = alert.quantity === 0
        const color    = critical ? DANGER : ACCENT
        const bg       = critical ? DANGER_DIM : ACCENT_DIM
        return (
          <div
            key={alert.id}
            style={{
              background: BG_CARD,
              border: `1px solid ${color}`,
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
          >
            <div
              style={{
                width: 36, height: 36, borderRadius: 8,
                background: bg, flexShrink: 0,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 18,
              }}
            >
              {critical ? '🚨' : '⚠️'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 2 }}>
                {critical ? 'Out of Stock' : 'Low Stock Alert'}
              </div>
              <div style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.4 }}>
                <span style={{ color, fontWeight: 600 }}>{alert.productName}</span>
                {critical
                  ? ' is now out of stock.'
                  : ` has only ${alert.quantity} left (threshold: ${alert.threshold}).`}
              </div>
              <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>
                {new Date(alert.timestamp).toLocaleTimeString('en-PH')}
              </div>
            </div>
            <button
              onClick={() => dismissAlert(alert.id)}
              style={{
                background: 'none', border: 'none',
                color: TEXT_MUTED, fontSize: 18,
                cursor: 'pointer', lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}