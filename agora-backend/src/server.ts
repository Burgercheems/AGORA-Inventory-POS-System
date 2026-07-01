import { createServer } from 'http'
import { Server } from 'socket.io'
import app from './app'
import jwt from 'jsonwebtoken'

const PORT = process.env.PORT || 3000

const httpServer = createServer(app)

export const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      process.env.FRONTEND_URL,
    ].filter(Boolean) as string[],
    credentials: true,
  },
})

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next() // allow anonymous connection if you don't want to hard-require auth

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as any
    socket.data.user = payload
    next()
  } catch (err) {
    next(new Error('Authentication failed'))
  }
})

io.on('connection', (socket) => {
  console.log('[Socket] Client connected:', socket.id)

  // Join the 'staff' room so low-stock-alert broadcasts reach this client.
  // Adjust the role check below to match your actual JWT payload shape.
  const role = socket.data.user?.role
  if (role && role !== 'CASHIER') {
    socket.join('staff')
  }

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Client disconnected:', socket.id, reason)
  })
})

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})