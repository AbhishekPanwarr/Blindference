import { BrowserRouter, Link, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import {
  Search,
  History,
  Settings,
  BookOpen,
  MessageSquare,
  Bell,
  Cpu,
  Globe,
  Server,
  CreditCard,
  ShieldCheck,
} from 'lucide-react'

import { InferenceNewPage } from './pages/InferenceNewPage'
import { InferenceStatusPage } from './pages/InferenceStatusPage'
import { HistoryPage } from './pages/HistoryPage'
import { NodeRegistrationPage } from './pages/NodeRegistrationPage'
import { SettingsPage } from './pages/SettingsPage'
import { BuyCreditsPage } from './pages/BuyCreditsPage'
import { CreateEscrowPage } from './pages/CreateEscrowPage'
import { ProtocolUpdatePopup } from './components/ProtocolUpdatePopup'
import { truncateAddress } from './utils/helpers'

function Placeholder({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center text-white">
      <h1 className="mb-3 text-3xl font-bold">{title}</h1>
      <p className="text-sm text-zinc-500 max-w-lg mx-auto leading-relaxed">
        {subtitle || 'This module is under active development.'}
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
        className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-center transition-colors hover:border-zinc-600 hover:bg-zinc-800"
        onClick={() => disconnect()}
        type="button"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        <span className="font-mono text-xs font-semibold text-zinc-200">{truncateAddress(address)}</span>
      </button>
    )
  }

  return (
    <button
      className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800 disabled:opacity-50"
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

function SideNavItem({
  to,
  icon: Icon,
  label,
  badge,
}: {
  to: string
  icon: any
  label: string
  badge?: string
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          isActive
            ? 'bg-zinc-800 text-white font-medium'
            : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
        }`
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="rounded-full bg-zinc-700 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300 uppercase tracking-wide">
          {badge}
        </span>
      )}
    </NavLink>
  )
}

function Sidebar() {
  return (
    <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-[#0d0d0d] h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white text-black font-extrabold text-sm">
          B
        </div>
        <span className="font-semibold text-sm tracking-[0.28em] text-white">
          BLINDFERENCE
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2 py-4 overflow-y-auto">
        <SideNavItem to="/" icon={Search} label="Inference" />
        <SideNavItem to="/history" icon={History} label="History" />
        <SideNavItem to="/buy-credits" icon={CreditCard} label="Buy Credits" badge="NEW" />
        <SideNavItem to="/create-escrow" icon={ShieldCheck} label="Create Escrow" />
        <SideNavItem to="/node-registration" icon={Server} label="Node Registration" />
        <SideNavItem to="/settings" icon={Settings} label="Settings" />
      </nav>

      {/* Bottom */}
      <div className="border-t border-zinc-800 px-2 py-4 space-y-0.5">
        <SideNavItem to="/docs" icon={BookOpen} label="Documentation" />
        <SideNavItem to="/support" icon={MessageSquare} label="Support" />
        <div className="mt-3 px-2 py-2 text-[10px] text-zinc-600 font-mono">v3.0.0-beta</div>
      </div>
    </aside>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-zinc-800 bg-[#0d0d0d]/90 backdrop-blur-md px-6">
      <div className="flex items-center gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
          ICL: Online
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
          CoFHE: Active
        </span>
        <span className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-zinc-400" />
          Quorum: Live
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          className="relative p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
          type="button"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-zinc-300 border border-[#0d0d0d]" />
        </button>
        <WalletBadge />
      </div>
    </header>
  )
}

function MobileHeader() {
  return (
    <header className="lg:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-zinc-800 bg-[#0d0d0d]/90 backdrop-blur-md px-4">
      <Link to="/" className="flex items-center gap-2">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white text-black font-extrabold text-xs">
          B
        </div>
        <span className="font-semibold text-sm tracking-[0.2em] text-white">
          BLINDFERENCE
        </span>
      </Link>
      <WalletBadge />
    </header>
  )
}

function Layout() {
  return (
    <div className="flex min-h-screen bg-[#09090b] text-white">
      <ProtocolUpdatePopup />
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <MobileHeader />
        <Header />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
        <footer className="border-t border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-[10px] text-zinc-600 font-medium">EN</span>
          </div>
          <div className="font-mono text-[10px] text-zinc-600">
            v3.0.0-beta | cofhe-sdk live
          </div>
        </footer>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />} path="/">
          <Route element={<InferenceNewPage />} index />
          <Route element={<InferenceStatusPage />} path="inference/:requestId" />
          <Route element={<HistoryPage />} path="history" />
          <Route element={<BuyCreditsPage />} path="buy-credits" />
          <Route element={<CreateEscrowPage />} path="create-escrow" />
          <Route element={<NodeRegistrationPage />} path="node-registration" />
          <Route element={<SettingsPage />} path="settings" />
          <Route
            element={
              <Placeholder
                title="Documentation"
                subtitle="Protocol documentation and API references."
              />
            }
            path="docs"
          />
          <Route
            element={
              <Placeholder
                title="Support"
                subtitle="Contact support and view troubleshooting guides."
              />
            }
            path="support"
          />
          <Route
            element={
              <Placeholder
                title="Model Marketplace"
                subtitle="Browse available inference models and agents."
              />
            }
            path="models"
          />
          <Route
            element={
              <Placeholder
                title="Network Coverage"
                subtitle="Insurance and dispute coverage management."
              />
            }
            path="coverage"
          />
          <Route
            element={
              <Placeholder
                title="Dashboard"
                subtitle="Advanced analytics and node monitoring."
              />
            }
            path="dashboard"
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
