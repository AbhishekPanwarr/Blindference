import { BrowserRouter, Link, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Toaster, ToastBar } from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, AlertCircle } from 'lucide-react'
import { lazy, Suspense, useMemo } from 'react'

import { InferenceNewPage } from './pages/InferenceNewPage'
import { InferenceStatusPage } from './pages/InferenceStatusPage'
import { HistoryPage } from './pages/HistoryPage'
import { NodeRegistrationPage } from './pages/NodeRegistrationPage'
import { SettingsPage } from './pages/SettingsPage'
import { BuyCreditsPage } from './pages/BuyCreditsPage'
import { CreateEscrowPage } from './pages/CreateEscrowPage'
import { NodeDashboardPage } from './pages/NodeDashboardPage'
import { WalletPage } from './pages/WalletPage'
import LandingPage from './pages/LandingPage'
import { truncateAddress } from './utils/helpers'

const DocsLayout = lazy(() => import('./pages/docs/DocsLayout'))

function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connectors, connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const injected = connectors[0]

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="flex items-center gap-2 rounded-full bg-white/[0.05] border border-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.1] hover:border-white/20 transition-all"
      >
        <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
        <span className="font-mono">{truncateAddress(address)}</span>
      </button>
    )
  }

  return (
    <button
      onClick={() => injected && connect({ connector: injected })}
      disabled={!injected || isPending}
      className="rounded-full bg-white text-black px-5 py-2 text-xs font-bold hover:bg-gray-100 transition-all disabled:opacity-50"
    >
      {isPending ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}

function Navbar() {
  const location = useLocation()
  const isLanding = location.pathname === '/'

  const navItems = [
    { path: '/app', label: 'Inference' },
    { path: '/history', label: 'History' },
    { path: '/wallet', label: 'Wallet' },
    { path: '/buy-credits', label: 'Credits' },
    { path: '/create-escrow', label: 'Escrow' },
    { path: '/node-dashboard', label: 'Nodes' },
    { path: '/node-registration', label: 'Join' },
    { path: '/settings', label: 'Settings' },
  ]

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 h-20 flex items-center justify-center px-6 pointer-events-none"
    >
      <div className="w-full max-w-7xl flex items-center justify-between pointer-events-auto">
        {/* Logo */}
        <Link to="/" className="group flex items-center gap-3 no-underline">
          <div className="relative w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)] group-hover:shadow-[0_0_35px_rgba(249,115,22,0.4)] transition-all duration-500">
            <div className="w-4 h-4 border-2 border-black group-hover:border-orange-500 rotate-45 group-hover:rotate-90 transition-all duration-500" />
          </div>
          <div className="flex flex-col">
            <span className="relative text-xl font-bold text-white tracking-tight transition-colors duration-500">
              <span className="absolute inset-0 text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-300 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.3)]" aria-hidden="true">Blindference</span>
              <span className="group-hover:opacity-0 transition-opacity duration-500">Blindference</span>
            </span>
            <span className="relative text-[10px] text-gray-400 uppercase tracking-widest font-medium transition-colors duration-500">
              <span className="absolute inset-0 text-orange-400/80 opacity-0 group-hover:opacity-100 transition-opacity duration-500" aria-hidden="true">Confidential AI</span>
              <span className="group-hover:opacity-0 transition-opacity duration-500">Confidential AI</span>
            </span>
          </div>
        </Link>

        {/* Navigation Pill */}
        {!isLanding && (
          <div className="absolute left-1/2 -translate-x-1/2 flex max-w-[calc(100%-400px)] items-center p-1.5 rounded-full bg-white/[0.03] backdrop-blur-[32px] border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.8)] gap-0.5 overflow-x-auto scrollbar-hide">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive: active }) =>
                    `relative px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-500 whitespace-nowrap ${
                      active ? 'text-white' : 'text-white/40 hover:text-white'
                    }`
                  }
                >
                  {isActive && (
                    <motion.span
                      layoutId="navbar-active-indicator"
                      className="absolute inset-0 rounded-full bg-white/[0.08] border border-white/10 shadow-[inset_0_0_12px_rgba(255,255,255,0.05),0_0_20px_rgba(0,0,0,0.2)]"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </NavLink>
              )
            })}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4">
          {isLanding && (
            <Link
              to="/app"
              className="hidden md:flex items-center justify-center gap-2 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 px-6 py-2.5 rounded-full backdrop-blur-[24px] transition-all duration-500 text-sm font-semibold text-white group shadow-[0_8px_32px_0_rgba(0,0,0,0.2)]"
            >
              Get Started
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          )}
          <WalletButton />
        </div>
      </div>
    </motion.nav>
  )
}

function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px] animate-float" />
      <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-zinc-800/20 rounded-full blur-[100px] animate-float-delayed" />
      <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-white/5 rounded-full blur-[120px] animate-pulse-slow" />
      <div className="absolute top-[60%] left-[60%] w-[25%] h-[25%] bg-orange-500/5 rounded-full blur-[100px] animate-float" />
    </div>
  )
}

const RouteFallback = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  </div>
)

const AppLayout = () => (
  <div className="min-h-screen bg-black text-white relative overflow-hidden">
    <BackgroundOrbs />
    <Navbar />
    <main className="relative z-10 pt-24 px-4 pb-12 container-custom min-h-screen">
      <Outlet />
    </main>
  </div>
)

function App() {
  const appContent = useMemo(() => (
    <>
      <Toaster position="bottom-center" containerStyle={{ bottom: 40 }}>
        {(t) => (
          <AnimatePresence mode="popLayout">
            {t.visible && (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                className="pointer-events-auto"
              >
                <ToastBar
                  toast={t}
                  style={{
                    ...t.style,
                    background: 'rgba(10, 10, 10, 0.92)',
                    color: '#fff',
                    border: '1px solid rgba(249, 115, 22, 0.24)',
                    borderRadius: '24px',
                    fontSize: '15.5px',
                    fontWeight: '500',
                    boxShadow: '0 28px 72px -12px rgba(0, 0, 0, 0.8)',
                    whiteSpace: 'nowrap',
                    maxWidth: 'none',
                    padding: '12px 32px',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  {({ icon, message }: any) => (
                    <div className="flex items-center gap-3.5">
                      {t.type === 'success' ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500/10 shadow-[0_0_12px_rgba(249,115,22,0.2)]">
                          <Check className="h-3.5 w-3.5 text-orange-400 stroke-[3]" />
                        </div>
                      ) : t.type === 'error' ? (
                        <AlertCircle className="h-5 w-5 text-red-400" />
                      ) : (
                        icon
                      )}
                      <div className="tracking-tight text-white/95">{message}</div>
                    </div>
                  )}
                </ToastBar>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </Toaster>
      <Routes>
        <Route element={<LandingPage />} path="/" />
        <Route element={<AppLayout />} path="/">
          <Route element={<InferenceNewPage />} path="app" />
          <Route element={<InferenceStatusPage />} path="inference/:requestId" />
          <Route element={<HistoryPage />} path="history" />
          <Route element={<WalletPage />} path="wallet" />
          <Route element={<BuyCreditsPage />} path="buy-credits" />
          <Route element={<CreateEscrowPage />} path="create-escrow" />
          <Route element={<NodeRegistrationPage />} path="node-registration" />
          <Route element={<NodeDashboardPage />} path="node-dashboard" />
          <Route element={<SettingsPage />} path="settings" />
          <Route element={
            <Suspense fallback={<RouteFallback />}>
              <DocsLayout />
            </Suspense>
          } path="docs/*" />
        </Route>
      </Routes>
    </>
  ), [])

  return (
    <BrowserRouter>
      {appContent}
    </BrowserRouter>
  )
}

export default App
