import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

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

interface CameraScannerProps {
  onProductFound: (product: Product) => void
  onClose: () => void
}

// ── same design tokens as OrdersPage ─────────────────────────────────────────
const BG_BASE    = '#0f172a'
const BG_CARD    = '#1e293b'
const BORDER     = '#334155'
const TEXT_PRIMARY   = '#f1f5f9'
const TEXT_MUTED     = '#475569'
const ACCENT     = '#f59e0b'
const ACCENT_DIM = 'rgba(245,158,11,0.12)'
const DANGER     = '#f87171'


import api from '../services/api'

export default function CameraScanner({ onProductFound, onClose }: CameraScannerProps) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const rafRef     = useRef<number>(0)

  const [status, setStatus]         = useState<'requesting' | 'scanning' | 'found' | 'error'>('requesting')
  const [errorMsg, setErrorMsg]     = useState('')
  const [lastScanned, setLastScanned] = useState('')
  const [manualInput, setManualInput] = useState('')
  const [looking, setLooking]       = useState(false)

  // ── start camera ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setStatus('scanning')
          startDecodeLoop()
        }
      } catch (err: unknown) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Unknown error'
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
          setErrorMsg('Camera permission denied. Please allow camera access and try again.')
        } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
          setErrorMsg('No camera found on this device.')
        } else {
          setErrorMsg(`Camera error: ${msg}`)
        }
        setStatus('error')
      }
    }

    startCamera()
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [])

  function stopCamera() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  // ── QR decode loop (AGORA-085) ───────────────────────────────────────────────
  function startDecodeLoop() {
    function tick() {
      const video  = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      })
      if (code && code.data && code.data !== lastScanned) {
        handleScannedValue(code.data)
        return           // stop loop while we look up the product
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  // ── product lookup (AGORA-086) ───────────────────────────────────────────────
  async function handleScannedValue(value: string) {
    if (looking) return
    setLooking(true)
    setLastScanned(value)
    try {
      const res = await api.get('/products/lookup', { params: { qr: value } })
      const product: Product = res.data?.data ?? res.data
      stopCamera()
      setStatus('found')
      onProductFound(product)
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setErrorMsg(
        msg.includes('404') || msg.includes('not found')
          ? `No product found for: "${value}"`
          : 'Lookup failed. Please try again.'
      )
      setStatus('error')
    } finally {
      setLooking(false)
    }
  }

  // ── manual input submit (AGORA-087) ─────────────────────────────────────────
  async function handleManualSubmit() {
    const val = manualInput.trim()
    if (!val) return
    stopCamera()
    await handleScannedValue(val)
  }

  // ── retry ────────────────────────────────────────────────────────────────────
  function handleRetry() {
    setStatus('requesting')
    setErrorMsg('')
    setLastScanned('')
    setManualInput('')
    setLooking(false)
    // re-mount effect by toggling; simplest: close and reopen
    // instead we directly restart:
    async function restart() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setStatus('scanning')
          startDecodeLoop()
        }
      } catch {
        setErrorMsg('Could not restart camera.')
        setStatus('error')
      }
    }
    restart()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: BG_CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          width: '100%',
          maxWidth: 400,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <div>
            <div style={{ color: TEXT_PRIMARY, fontWeight: 700, fontSize: 15 }}>
              Scan QR / Barcode
            </div>
            <div style={{ color: TEXT_MUTED, fontSize: 12, marginTop: 2 }}>
              Point camera at product code
            </div>
          </div>
          <button
            onClick={() => { stopCamera(); onClose() }}
            style={{
              background: 'none', border: 'none',
              color: TEXT_MUTED, fontSize: 22, cursor: 'pointer', lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Camera viewport */}
        <div
          style={{
            position: 'relative',
            background: BG_BASE,
            aspectRatio: '1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              display: status === 'scanning' ? 'block' : 'none',
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Scan frame overlay */}
          {status === 'scanning' && (
            <div
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: 200, height: 200,
                  border: `2px solid ${ACCENT}`,
                  borderRadius: 12,
                  boxShadow: `0 0 0 9999px rgba(0,0,0,0.45)`,
                }}
              />
            </div>
          )}

          {/* Requesting state */}
          {status === 'requesting' && (
            <div style={{ textAlign: 'center', padding: 32, color: TEXT_MUTED }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
              <div style={{ fontSize: 13 }}>Requesting camera…</div>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
              <div style={{ color: DANGER, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                {errorMsg}
              </div>
              <button
                onClick={handleRetry}
                style={{
                  background: ACCENT_DIM, border: `1px solid ${ACCENT}`,
                  borderRadius: 8, padding: '8px 20px',
                  color: ACCENT, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Looking up */}
          {looking && (
            <div
              style={{
                position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.8)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{ color: ACCENT, fontSize: 13 }}>Looking up product…</div>
            </div>
          )}
        </div>

        {/* Manual input fallback (AGORA-087) */}
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${BORDER}` }}>
          <div
            style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: TEXT_MUTED, marginBottom: 8,
            }}
          >
            Or enter barcode manually
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
              placeholder="Type barcode or QR value…"
              style={{
                flex: 1,
                background: BG_BASE, border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: '10px 12px',
                color: TEXT_PRIMARY, fontSize: 13, outline: 'none',
              }}
            />
            <button
              onClick={handleManualSubmit}
              disabled={!manualInput.trim() || looking}
              style={{
                background: manualInput.trim() ? ACCENT : BORDER,
                border: 'none', borderRadius: 8,
                padding: '10px 16px',
                color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: manualInput.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Search
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}