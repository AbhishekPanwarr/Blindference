import { BrowserRouter, Link, Outlet, Route, Routes } from 'react-router-dom'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Sparkles, Globe } from 'lucide-react'

import { HomePage } from './pages/HomePage'
import { InferenceNewPage } from './pages/InferenceNewPage'
import { InferenceStatusPage } from './pages/InferenceStatusPage'
import { Wave3Popup } from './components/Wave3Popup'
import { truncateAddress } from './utils/helpers'

function Placeholder({ title, subtitle }: { title: string, subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center text-white">
      <h1 className="mb-3 text-3xl font-bold">{title}</h1>
      <p className="text-sm text-gray-400 max-w-lg mx-auto leading-relaxed">
        {subtitle || "This module is under development for the Wave 3 demo."}
      </p>
    </div>
  )
}

function WalletBadge() {
  const { address, isConnected } = useAccount()
  const { connectors, connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  const injectedConnector = connectors[0]

  if (isConnected && address) {
    return (
      <button
        className="rounded border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-center transition-colors hover:border-emerald-500/40 ml-4"
        onClick={() => disconnect()}
        type="button"
      >
        <span className="font-mono text-sm font-semibold text-emerald-400">{truncateAddress(address)}</span>
      </button>
    )
  }

  return (
    <button
      className="rounded border border-white/20 bg-white px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-200 disabled:opacity-50 ml-4"
      disabled={!injectedConnector || isPending}
      onClick={() => {
        if (injectedConnector) {
          connect({ connector: injectedConnector })
        }
      }}
      type="button"
    >
      {isPending ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}

function Layout() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-black font-sans text-white selection:bg-emerald-500/30">
      <Wave3Popup />
      
      {/* Top Nav (0g.ai style) */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-black/80 backdrop-blur-md px-6 flex justify-between items-center h-16">
        <div className="flex items-center">
          <Link className="flex items-center group" to="/">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 text-black font-extrabold text-lg mr-3">
              B
            </div>
            <span className="text-lg font-bold tracking-tight uppercase">
              BLINDFERENCE
            </span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-[13px] font-semibold text-gray-400">
          <Link className="transition-colors hover:text-white" to="/">
            Home
          </Link>
          <div className="relative group">
            <Link className="transition-colors hover:text-white flex items-center gap-1.5" to="/models">
              Models
              <Sparkles className="w-3 h-3 text-emerald-500" />
            </Link>
          </div>
          <div className="relative group">
            <Link className="transition-colors hover:text-white flex items-center gap-1.5" to="/nodes">
              Nodes
              <Sparkles className="w-3 h-3 text-emerald-500" />
            </Link>
          </div>
          <Link className="transition-colors hover:text-white" to="/coverage">
            Coverage
          </Link>
          <Link className="transition-colors hover:text-white" to="/dashboard">
            Dashboard
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 border-r border-white/20 pr-4">
             <Globe className="w-4 h-4 text-gray-400" />
             <span className="text-xs font-bold text-gray-400">EN</span>
          </div>
          <WalletBadge />
        </div>
      </header>

      <main className="w-full flex-1">
        <Outlet />
      </main>

      <footer className="mt-auto flex w-full items-center justify-between border-t border-white/10 bg-black px-8 py-6">
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
              ICL Gateway: Online
            </span>
          </div>
        </div>
        <div className="font-mono text-[10px] text-gray-600">v3.0.0-stable | cofhe-sdk live</div>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />} path="/">
          <Route element={<HomePage />} index />
          <Route element={<Placeholder title="Model Marketplace" subtitle="This module will be added in upcoming waves." />} path="models" />
          <Route element={<Placeholder title="Network Nodes" subtitle="Node visualization will be added in upcoming waves." />} path="nodes" />
          <Route element={<InferenceNewPage />} path="inference/new" />
          <Route element={<InferenceStatusPage />} path="inference/:requestId" />
          <Route element={<Placeholder title="Inference Coverage" subtitle="Reineira settlement is under development from both blindference and reineira teams mutual side." />} path="coverage" />
          <Route element={<Placeholder title="User Dashboard" />} path="dashboard" />
          <Route element={<Placeholder title="Join the Network" subtitle="Node joining instructions will be added in upcoming waves." />} path="join-node" />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
