import { useState, useEffect } from 'react'
import { useAccount, useDisconnect, useConnect } from 'wagmi'
import { LogOut, Wallet, Lock, Unlock, Globe, Trash2, CheckCircle, Copy, Shield, Cpu } from 'lucide-react'

export function SettingsPage() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { connectors, connect, isPending } = useConnect()
  const injectedConnector = connectors[0]

  const [autoDecrypt, setAutoDecrypt] = useState(false)
  const [copied, setCopied] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [cofheStatus, setCofheStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown')

  useEffect(() => {
    try {
      setAutoDecrypt(localStorage.getItem('blindference_auto_decrypt') === 'true')
    } catch {
      setAutoDecrypt(false)
    }
  }, [])

  const toggleAutoDecrypt = (val: boolean) => {
    setAutoDecrypt(val)
    try {
      localStorage.setItem('blindference_auto_decrypt', String(val))
    } catch {
      // ignore
    }
  }

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClearStorage = () => {
    localStorage.removeItem('protocol_update_seen_v2')
    localStorage.removeItem('blindference_history_v1')
    setCleared(true)
    setTimeout(() => setCleared(false), 2000)
  }

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-1">Settings</h1>
        <p className="text-sm text-zinc-500">Wallet, network, and protocol configuration.</p>
      </div>

      {/* Wallet */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Wallet className="w-4 h-4 text-zinc-400" />
          Wallet
        </h2>

        {isConnected && address ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-[#0a0a0b]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-zinc-400" />
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Connected</div>
                  <div className="text-sm font-mono text-white">{address.slice(0, 6)}...{address.slice(-4)}</div>
                </div>
              </div>
              <button
                onClick={handleCopy}
                className="p-2 text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={() => disconnect()}
              className="w-full py-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
            >
              Disconnect Wallet
            </button>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-zinc-400 mb-4">No wallet connected.</p>
            <button
              disabled={!injectedConnector || isPending}
              onClick={() => injectedConnector && connect({ connector: injectedConnector })}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              <Wallet className="w-4 h-4" />
              {isPending ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </div>
        )}
      </section>

      {/* Network */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Globe className="w-4 h-4 text-zinc-400" />
          Network
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-[#0a0a0b]">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <Cpu className="w-4 h-4 text-zinc-500" />
              Active Chain
            </div>
            <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-1 rounded border border-zinc-700">
              Arbitrum Sepolia (421614)
            </span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-[#0a0a0b]">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <Lock className="w-4 h-4 text-zinc-500" />
              CoFHE Status
            </div>
            <span className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${
              cofheStatus === 'connected'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : cofheStatus === 'disconnected'
                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}>
              {cofheStatus === 'connected' ? 'CONNECTED' : cofheStatus === 'disconnected' ? 'DISCONNECTED' : 'LOADING'}
            </span>
          </div>
        </div>
      </section>

      {/* Privacy / Decryption */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          {autoDecrypt ? <Unlock className="w-4 h-4 text-zinc-400" /> : <Lock className="w-4 h-4 text-zinc-400" />}
          Decryption Preference
        </h2>
        <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-[#0a0a0b]">
          <div>
            <div className="text-sm font-medium text-white">Auto-decrypt results</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {autoDecrypt
                ? 'Results are automatically decrypted when ready. Plaintext exists only in your browser.'
                : 'You must manually click "Decrypt to View" for each result. More control, more clicks.'}
            </div>
          </div>
          <button
            onClick={() => toggleAutoDecrypt(!autoDecrypt)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoDecrypt ? 'bg-white' : 'bg-zinc-700'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${autoDecrypt ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
      </section>

      {/* Storage */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-zinc-400" />
          Local Storage
        </h2>
        <p className="text-xs text-zinc-500">
          Clear cached onboarding state, permits, history, and other browser-stored data.
        </p>
        <button
          onClick={handleClearStorage}
          className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          {cleared ? 'Cleared ✓' : 'Clear Local Storage'}
        </button>
      </section>

      {/* Version */}
      <div className="text-center">
        <div className="text-[10px] text-zinc-700 font-mono">
          Blindference Frontend v3.0.0-beta · CoFHE SDK 0.5.2 · React 19
        </div>
      </div>
    </div>
  )
}
