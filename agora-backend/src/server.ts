import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { requestLogger } from './middleware/logger.middleware'
import { apiRateLimiter } from './middleware/rateLimiter.middleware'  // ADD THIS
import authRoutes from './routes/auth.routes'
import productRoutes from './routes/product.routes'
import categoryRoutes from './routes/category.routes'
import supplierRoutes from './routes/supplier.routes'
import stockRoutes from './routes/stock.routes'
import orderRoutes from './routes/order.routes'
import transactionRoutes from './routes/transaction.routes'
import userRoutes from './routes/user.routes'  
import reportRoutes from './routes/report.routes'

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())
app.use(requestLogger)

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/suppliers', supplierRoutes)
app.use('/api/stock', stockRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/users', userRoutes)
app.use(requestLogger)
app.use(apiRateLimiter)  
app.use('/api/reports', reportRoutes)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})