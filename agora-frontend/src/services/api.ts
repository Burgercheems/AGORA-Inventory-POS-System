import axios from 'axios'
import { useAuthStore } from '../stores/useAuthStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // required so the httpOnly refresh cookie is sent/received
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Prevents multiple simultaneous refresh calls if several requests 401 at once.
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh')
      .then((res) => {
        const { accessToken, user } = res.data
        // user may be undefined on plain refresh responses depending on backend shape;
        // only overwrite if present so we don't wipe the existing user on a bare token refresh
        if (user) {
          useAuthStore.getState().setAuth(user, accessToken)
        } else {
          useAuthStore.getState().setToken(accessToken)
        }
        return accessToken
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config

    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const newToken = await refreshAccessToken()
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch {
        useAuthStore.getState().logout()
        return Promise.reject(err)
      }
    }

    return Promise.reject(err)
  }
)

export default api