export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MANAGER'
  | 'CASHIER'

export interface User {
  id: string
  name: string
  email: string
  role: Role
}

export interface Product {
  id: string
  name: string
  sku: string
  barcode: string
  price: number
  status: 'active' | 'inactive'
  categoryId: string
  supplierId: string
}

export interface OrderItem {
  productId: string
  quantity: number
  unitPrice: number
}

export interface Order {
  id: string
  cashierId: string
  total: number
  discount: number
  status: string
  createdAt: string
  items: OrderItem[]
}