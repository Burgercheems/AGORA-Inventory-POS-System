import { io } from '../server'

export function emitStockUpdate(productId: string, productName: string, quantity: number) {
  io.emit('stock-update', { productId, productName, quantity })
}

export function emitLowStockAlert(
  productId: string,
  productName: string,
  quantity: number,
  threshold: number
) {
  io.to('staff').emit('low-stock-alert', { productId, productName, quantity, threshold })
}