import { create } from 'zustand'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isInitializing: boolean
  setAuth: (user: User, token: string) => void
  setToken: (token: string) => void
  logout: () => void
  setInitializing: (value: boolean) => void
}

// No `persist` middleware on purpose — token must never touch localStorage.
// The refresh token lives in an httpOnly cookie set by the backend;
// the access token lives only in memory and is re-fetched on page load
// via the /api/auth/refresh call (see App.tsx bootstrap effect).
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  token: null,
  isInitializing: true,
  setAuth: (user, token) => set({ user, token, isInitializing: false }),
  setToken: (token) => set({ token }),
  logout: () => set({ user: null, token: null }),
  setInitializing: (value) => set({ isInitializing: value }),
}))