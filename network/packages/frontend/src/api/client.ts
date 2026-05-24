import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_ICL_API_URL || 'http://127.0.0.1:8000',
  headers: { 'Content-Type': 'application/json' },
})

export const paymentApiClient = axios.create({
  baseURL: import.meta.env.VITE_PAYMENT_API_URL || 'http://127.0.0.1:8001',
  headers: { 'Content-Type': 'application/json' },
})
