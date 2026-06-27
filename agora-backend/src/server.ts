import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import http from 'http'
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { requestLogger } from './middleware/logger.middleware'
import { apiRateLimiter } from './middleware/rateLimiter.middleware'
import authRoutes from './routes/auth.routes'
import productRoutes from './routes/product.routes'
import categoryRoutes from './routes/category.routes'
import supplierRoutes from './routes/supplier.routes'
import stockRoutes from './routes/stock.routes'
import orderRoutes from './routes/order.routes'
import transactionRoutes from './routes/transaction.routes'
import userRoutes from './routes/user.routes'
import reportRoutes from './routes/report.routes'
import cookieParser from 'cookie-parser'

dotenv.config()

const app = express()
const httpServer = http.createServer(app)

// ── Socket.io (AGORA-096) ─────────────────────────────────────────────────────
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})

// ── JWT auth handshake (AGORA-097) ────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('No token provided'))
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string
      role: string
    }
    socket.data.userId = decoded.id
    socket.data.role   = decoded.role
    next()
  } catch {
    next(new Error('Invalid token'))
  }
})

// ── AGORA-100: Admin + Manager room ──────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id} role=${socket.data.role}`)

  const role = socket.data.role
  if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MANAGER') {
    socket.join('staff')
    console.log(`[Socket] ${socket.id} joined staff room`)
  }

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${socket.id} reason=${reason}`)
  })
})

// ── Express middleware ────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json())
app.use(cookieParser())
app.use(requestLogger)
app.use(apiRateLimiter)

app.get('/health', (req: Request, res: Response) => {
  const timestamp = new (globalThis as any).Date().toISOString()
  res.status(200).json({ status: 'ok', timestamp })
})

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/suppliers', supplierRoutes)
app.use('/api/stock', stockRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/users', userRoutes)
app.use('/api/reports', reportRoutes)

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})