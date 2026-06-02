import { useState, useEffect } from 'react'
import { useAccount, useDisconnect, useConnect } from 'wagmi'
import { LogOut, Wallet, Lock, Unlock, Globe, Trash2, CheckCircle, Copy, Shield, Cpu, HelpCircle, RotateCcw } from 'lucide-react'
import { useTutorialContext } from '../components/tutorial'
import { GlassCard } from '../components/ui/GlassCard'
import { Badge } from '../components/ui/Badge'
import { SectionLabel } from '../components/effects/GlowDivider'

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
    <div className="px-6 py-8 max-w-2xl mx-auto space-y-10">
      <div>
        <SectionLabel>SETTINGS</SectionLabel>
        <h1 className="text-2xl font-heading gradient-text mb-1 mt-1">Settings</h1>
        <p className="text-sm text-white/50">Wallet, network, and protocol configuration.</p>
      </div>

      {/* Wallet */}
      <GlassCard className="gradient-accent-top p-5 space-y-4">
        <h2 className="text-sm font-heading font-semibold text-white/90 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-white/50" />
          Wallet
        </h2>

        {isConnected && address ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-[rgba(10,10,10,0.6)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[rgba(10,10,10,0.6)] border border-white/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white/50" />
                </div>
                <div>
                  <div className="text-xs text-white/50">Connected</div>
                  <div className="text-sm font-mono text-white/90">{address.slice(0, 6)}...{address.slice(-4)}</div>
                </div>
              </div>
              <button
                onClick={handleCopy}
                className="p-2 text-white/50 hover:text-white/90 transition-colors"
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
            <p className="text-sm text-white/50 mb-4">No wallet connected.</p>
            <button
              disabled={!injectedConnector || isPending}
              onClick={() => injectedConnector && connect({ connector: injectedConnector })}
              className="inline-flex items-center gap-2 rounded-xl btn-primary px-6 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Wallet className="w-4 h-4" />
              {isPending ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </div>
        )}
      </GlassCard>

      {/* Network */}
      <GlassCard className="p-5 space-y-4">
        <h2 className="text-sm font-heading font-semibold text-white/90 flex items-center gap-2">
          <Globe className="w-4 h-4 text-white/50" />
          Network
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-[rgba(10,10,10,0.6)]">
            <div className="flex items-center gap-2 text-sm text-white/90">
              <Cpu className="w-4 h-4 text-white/50" />
              Active Chain
            </div>
            <Badge variant="secondary">
              Arbitrum Sepolia (421614)
            </Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-[rgba(10,10,10,0.6)]">
            <div className="flex items-center gap-2 text-sm text-white/90">
              <Lock className="w-4 h-4 text-white/50" />
              CoFHE Status
            </div>
            <Badge
              variant={
                cofheStatus === 'connected'
                  ? 'success'
                  : cofheStatus === 'disconnected'
                  ? 'destructive'
                  : 'secondary'
              }
            >
              {cofheStatus === 'connected' ? 'CONNECTED' : cofheStatus === 'disconnected' ? 'DISCONNECTED' : 'LOADING'}
            </Badge>
          </div>
        </div>
      </GlassCard>

      {/* Privacy / Decryption */}
      <GlassCard className="p-5 space-y-4">
        <h2 className="text-sm font-heading font-semibold text-white/90 flex items-center gap-2">
          {autoDecrypt ? <Unlock className="w-4 h-4 text-white/50" /> : <Lock className="w-4 h-4 text-white/50" />}
          Decryption Preference
        </h2>
        <div className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-[rgba(10,10,10,0.6)]">
          <div>
            <div className="text-sm font-medium text-white/90">Auto-decrypt results</div>
            <div className="text-xs text-white/50 mt-0.5">
              {autoDecrypt
                ? 'Results are automatically decrypted when ready. Plaintext exists only in your browser.'
                : 'You must manually click "Decrypt to View" for each result. More control, more clicks.'}
            </div>
          </div>
          <button
            onClick={() => toggleAutoDecrypt(!autoDecrypt)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoDecrypt ? 'bg-violet-500' : 'bg-[rgba(10,10,10,0.6)]'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoDecrypt ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
      </GlassCard>

      {/* Tutorial Settings */}
      <TutorialSettings />

      {/* Storage */}
      <GlassCard className="p-5 space-y-4">
        <h2 className="text-sm font-heading font-semibold text-white/90 flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-white/50" />
          Local Storage
        </h2>
        <p className="text-xs text-white/50">
          Clear cached onboarding state, permits, history, and other browser-stored data.
        </p>
        <button
          onClick={handleClearStorage}
          className="px-4 py-2 rounded-lg border border-white/10 bg-[rgba(10,10,10,0.6)] text-xs font-medium text-white/50 hover:bg-violet-500/10 transition-colors"
        >
          {cleared ? 'Cleared ✓' : 'Clear Local Storage'}
        </button>
      </GlassCard>

      {/* Version */}
      <div className="text-center">
        <div className="text-[10px] text-white/50 font-mono">
          Blindference Frontend v3.0.0-beta · CoFHE SDK 0.5.2 · React 19
        </div>
      </div>
    </div>
  )
}

function TutorialSettings() {
  const { enabled, inferenceSeen, setEnabled, resetTutorial } = useTutorialContext()
  const [resetting, setResetting] = useState(false)

  const handleReset = () => {
    resetTutorial()
    setResetting(true)
    setTimeout(() => setResetting(false), 2000)
  }

  return (
    <GlassCard className="p-5 space-y-4">
      <h2 className="text-sm font-heading font-semibold text-white/90 flex items-center gap-2">
        <HelpCircle className="w-4 h-4 text-white/50" />
        Inference Tutorial
      </h2>

      <div className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-[rgba(10,10,10,0.6)]">
        <div>
          <div className="text-sm font-medium text-white/90">Show inference tutorial</div>
          <div className="text-xs text-white/50 mt-0.5">
            {enabled
              ? 'A guided walkthrough will show on your next visit to the Inference page.'
              : 'Tutorial is disabled. Turn on to see it again.'}
          </div>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={enabled ? 'relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-violet-500' : 'relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-[rgba(10,10,10,0.6)]'}
        >
          <span
            className={enabled ? 'inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6' : 'inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1'}
          />
        </button>
      </div>

      <div className="p-3 rounded-lg border border-white/10 bg-[rgba(10,10,10,0.6)] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">Status</span>
          <span className={inferenceSeen ? 'text-xs font-mono text-white/70' : 'text-xs font-mono text-violet-400'}>
            {inferenceSeen ? 'Seen ✓' : 'Not seen'}
          </span>
        </div>
      </div>

      <button
        onClick={handleReset}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-[rgba(10,10,10,0.6)] text-xs font-medium text-white/50 hover:bg-violet-500/10 hover:text-white/80 transition-all"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        {resetting ? 'Reset ✓' : 'Replay Tutorial'}
      </button>
    </GlassCard>
  )
}
