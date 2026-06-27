import { useEffect } from 'react'
import { getSocket, disconnectSocket } from '../services/socket'
import { useStockStore } from '../stores/useStockStore'
import { useAuthStore } from '../stores/useAuthStore'

export function useSocket() {
  const { token } = useAuthStore()
  const { applyStockUpdate, addAlert } = useStockStore()

  useEffect(() => {
    if (!token) return

    const socket = getSocket(token)

    socket.on('stock-update', (data: {
      productId: string
      productName: string
      quantity: number
    }) => {
      applyStockUpdate(data)
    })

    socket.on('low-stock-alert', (data: {
      productId: string
      productName: string
      quantity: number
      threshold: number
    }) => {
      addAlert(data)
    })

    return () => {
      socket.off('stock-update')
      socket.off('low-stock-alert')
    }
  }, [token])
}

export function useSocketDisconnect() {
  useEffect(() => {
    return () => disconnectSocket()
  }, [])
}