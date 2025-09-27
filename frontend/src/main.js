import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'

// Create Pinia store
const pinia = createPinia()

// Create and mount app
const app = createApp(App)

// Global error handler
app.config.errorHandler = (error, instance, info) => {
  console.error('Global error:', error)
  console.error('Component:', instance)
  console.error('Info:', info)

  // In production, you might want to send this to an error tracking service
  if (process.env.NODE_ENV === 'production') {
    // sendToErrorTracking(error, instance, info)
  }
}

// Global warning handler
app.config.warnHandler = (msg, instance, trace) => {
  console.warn('Global warning:', msg)
  console.warn('Component:', instance)
  console.warn('Trace:', trace)
}

// Register global properties
app.config.globalProperties.$formatAddress = (address) => {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

app.config.globalProperties.$formatNumber = (number, decimals = 2) => {
  if (typeof number !== 'number') return '0'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(number)
}

app.config.globalProperties.$formatCurrency = (amount, currency = 'USD') => {
  if (typeof amount !== 'number') return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount)
}

// Install plugins
app.use(pinia)

// Mount the app
app.mount('#app')

// Log initialization
console.log('🚀 zkRisk-Agent Frontend Initialized')
console.log('📦 Environment:', process.env.NODE_ENV)
console.log('🌐 Base URL:', import.meta.env.BASE_URL)

// Service worker registration (for PWA capabilities)
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration)
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError)
      })
  })
}