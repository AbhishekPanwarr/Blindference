import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'

import App from './App'
import './index.css'
import { wagmiConfig } from './lib/wagmi'

// Suppress noisy MetaMask / browser extension warnings that are not app errors
const originalError = console.error
const originalWarn = console.warn
const extensionNoise = [
  'MaxListenersExceededWarning',
  'ObjectMultiplex',
  'Could not establish connection',
  'Receiving end does not exist',
  'contentscript.js',
  'content.js',
]

console.error = (...args: unknown[]) => {
  const msg = args.join(' ')
  if (extensionNoise.some((n) => msg.includes(n))) return
  originalError.apply(console, args)
}

console.warn = (...args: unknown[]) => {
  const msg = args.join(' ')
  if (extensionNoise.some((n) => msg.includes(n))) return
  originalWarn.apply(console, args)
}

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>,
)
