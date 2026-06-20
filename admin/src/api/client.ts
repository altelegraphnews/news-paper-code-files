import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

// Extend config to track retry flag
interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  timeout: 30_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept-Language': 'ar',
  },
})

// Request interceptor: attach access token
apiClient.interceptors.request.use(
  (config) => {
    const raw = localStorage.getItem('altilgraf-auth')
    if (raw) {
      try {
        const state = JSON.parse(raw)
        const token = state?.state?.accessToken
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`
        }
      } catch {
        // ignore parse errors
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: handle 401 → refresh → retry
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true
      try {
        const raw = localStorage.getItem('altilgraf-auth')
        if (!raw) throw new Error('No stored auth')
        const state = JSON.parse(raw)
        const refreshToken = state?.state?.refreshTokenValue
        if (!refreshToken) throw new Error('No refresh token')

        const res = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'}/auth/refresh`,
          {},
          { withCredentials: true }
        )
        const { accessToken } = res.data?.data ?? res.data

        // Update stored access token
        state.state.accessToken = accessToken
        localStorage.setItem('altilgraf-auth', JSON.stringify(state))

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
        }
        return apiClient(originalRequest)
      } catch {
        // Refresh failed → clear auth and redirect
        localStorage.removeItem('altilgraf-auth')
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
