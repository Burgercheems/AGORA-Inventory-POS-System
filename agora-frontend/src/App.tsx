import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/useAuthStore'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import InventoryPage from './pages/inventory/InventoryPage'
import OrdersPage from './pages/orders/OrdersPage'
import StockPage from './pages/stock/StockPage'
import PaymentsPage from './pages/payments/PaymentsPage'
import ReportsPage from './pages/reports/ReportsPage'
import AuditLogsPage from './pages/logs/AuditLogsPage'
import UsersPage from './pages/users/UsersPage'
import { Layout } from './components/Layout'
import { Role } from './types'

function ProtectedRoute({ children, roles }: { children: React.ReactNode, roles?: Role[] }) {
  const { user, token } = useAuthStore()
  if (!token || !user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><Layout><OrdersPage /></Layout></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute roles={['ADMIN','SUPER_ADMIN']}><Layout><InventoryPage /></Layout></ProtectedRoute>} />
        <Route path="/stock" element={<ProtectedRoute roles={['ADMIN','SUPER_ADMIN','MANAGER']}><Layout><StockPage /></Layout></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><Layout><PaymentsPage /></Layout></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute roles={['ADMIN','SUPER_ADMIN','MANAGER']}><Layout><ReportsPage /></Layout></ProtectedRoute>} />
        <Route path="/logs" element={<ProtectedRoute roles={['ADMIN','SUPER_ADMIN']}><Layout><AuditLogsPage /></Layout></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute roles={['ADMIN','SUPER_ADMIN']}><Layout><UsersPage /></Layout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}