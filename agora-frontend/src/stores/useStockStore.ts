import { create } from 'zustand'

export interface StockUpdate {
  productId: string
  productName: string
  quantity: number
}

export interface StockAlert {
  id: string
  productId: string
  productName: string
  quantity: number
  threshold: number
  timestamp: number
}

interface StockState {
  stockMap: Record<string, number>        // productId → quantity
  alerts: StockAlert[]
  setStock: (productId: string, quantity: number) => void
  applyStockUpdate: (update: StockUpdate) => void
  addAlert: (alert: Omit<StockAlert, 'id' | 'timestamp'>) => void
  dismissAlert: (id: string) => void
  clearAlerts: () => void
}

export const useStockStore = create<StockState>()((set) => ({
  stockMap: {},
  alerts: [],

  setStock: (productId, quantity) =>
    set((state) => ({
      stockMap: { ...state.stockMap, [productId]: quantity },
    })),

  applyStockUpdate: (update) =>
    set((state) => ({
      stockMap: { ...state.stockMap, [update.productId]: update.quantity },
    })),

  addAlert: (alert) =>
    set((state) => ({
      alerts: [
        {
          ...alert,
          id: `${alert.productId}-${Date.now()}`,
          timestamp: Date.now(),
        },
        ...state.alerts.slice(0, 9), // keep max 10 alerts
      ],
    })),

  dismissAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
    })),

  clearAlerts: () => set({ alerts: [] }),
}))