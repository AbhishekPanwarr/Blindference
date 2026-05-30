import { useAccount } from 'wagmi'
import { useDeveloperStats } from '../hooks/useDeveloperStats'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Shimmer } from '../components/ui/Shimmer'
import { CopyButton } from '../components/ui/CopyButton'
import {
  Code2,
  Wallet,
  Terminal,
  Package,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  ArrowRight,
  Loader2,
  Cpu,
  Layers,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { fadeInUp, staggerSlow } from '../lib/animations'
import { SectionLabel } from '../components/effects/GlowDivider'

const INSTALL_SNIPPET = `npm install @blindference/agent-sdk`

const USAGE_SNIPPET = `import { BlindferenceAgent } from '@blindference/agent-sdk'

const agent = new BlindferenceAgent({
  privateKey: process.env.BLINDFERENCE_PRIVATE_KEY,
  paymentServiceUrl: 'http://localhost:8001',
  rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
})

const result = await agent.infer({
  prompt: 'Explain quantum computing in simple terms',
  modelId: 'groq:llama-3.3-70b-versatile',
})

console.log(result.output)`

const SERVER_SNIPPET = `npx blindference-agent start \
  --port 4000 \
  --payment-service http://localhost:8001 \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc`

export function DeveloperDashboardPage() {
  const { address } = useAccount()
  const { stats, loading, error } = useDeveloperStats(address)

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center text-white">
        <Wallet className="w-10 h-10 text-white/50 mb-4" />
        <h1 className="text-xl font-semibold mb-2 font-heading">Connect Your Wallet</h1>
        <p className="text-sm text-white/50 max-w-md">
          Connect your MetaMask wallet to view your developer dashboard.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="px-6 py-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((i) => (
            <Shimmer key={i} className="h-32" />
          ))}
        </div>
        <Shimmer className="h-64 mb-8" />
        <Shimmer className="h-96" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-6 py-8 max-w-6xl mx-auto">
        <GlassCard className="p-8 text-center border-red-500/20">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-1">Failed to Load Stats</h2>
          <p className="text-sm text-white/60">{error}</p>
        </GlassCard>
      </div>
    )
  }

  const hasSdkJobs = stats && stats.total_jobs > 0

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerSlow}
        className="mb-8"
      >
        <motion.div variants={fadeInUp} className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Code2 className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <SectionLabel>DEVELOPER DASHBOARD</SectionLabel>
            <h1 className="text-2xl font-bold font-heading tracking-tight mt-1">Developer Dashboard</h1>
            <p className="text-sm text-white/50">Monitor your SDK usage and integration</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Stats Cards */}
      {hasSdkJobs && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerSlow}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
        >
          <motion.div variants={fadeInUp}>
            <GlassCard className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-orange-400" />
                </div>
                <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Total Jobs</span>
              </div>
              <div className="text-2xl font-bold">{stats?.total_jobs ?? 0}</div>
            </GlassCard>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <GlassCard className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Completed</span>
              </div>
              <div className="text-2xl font-bold text-green-400">{stats?.completed ?? 0}</div>
            </GlassCard>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <GlassCard className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-red-400" />
                </div>
                <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Failed</span>
              </div>
              <div className="text-2xl font-bold text-red-400">{stats?.failed ?? 0}</div>
            </GlassCard>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <GlassCard className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-orange-400" />
                </div>
                <span className="text-xs font-medium text-white/40 uppercase tracking-wider">cUSDC Spent</span>
              </div>
              <div className="text-2xl font-bold">{stats?.total_cusdc_spent?.toFixed(2) ?? '0.00'}</div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}

      {/* Welcome / No SDK Jobs */}
      {!hasSdkJobs && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="mb-8"
        >
          <GlassCard className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4">
              <Terminal className="w-8 h-8 text-orange-400" />
            </div>
            <h2 className="text-xl font-bold mb-2 font-heading">No SDK Jobs Yet</h2>
            <p className="text-sm text-white/50 max-w-md mx-auto mb-6">
              You haven't submitted any jobs via the Blindference Agent SDK. Install the SDK and start building confidential AI applications programmatically.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="primary" onClick={() => window.location.href = '/docs/build/quickstart'}>
                Read Docs
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={() => window.open('https://github.com/baync180705/blindference/tree/main/network/packages/agent-sdk', '_blank', 'noopener,noreferrer')}>
                <Code2 className="w-4 h-4" />
                View on GitHub
              </Button>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* SDK Documentation */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerSlow}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <motion.div variants={fadeInUp}>
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Package className="w-4 h-4 text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold">Installation</h3>
            </div>
            <div className="relative bg-black/40 rounded-xl border border-white/10 p-4 mb-4">
              <code className="text-sm font-mono text-green-400">{INSTALL_SNIPPET}</code>
              <div className="absolute top-3 right-3">
                <CopyButton text={INSTALL_SNIPPET} />
              </div>
            </div>
            <p className="text-sm text-white/50">
              Install the SDK via npm. Requires Node.js 18+.
            </p>
          </GlassCard>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Terminal className="w-4 h-4 text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold">Quick Start</h3>
            </div>
            <div className="relative bg-black/40 rounded-xl border border-white/10 p-4 mb-4 overflow-x-auto">
              <pre className="text-sm font-mono text-white/80">
                <code>{USAGE_SNIPPET}</code>
              </pre>
              <div className="absolute top-3 right-3">
                <CopyButton text={USAGE_SNIPPET} />
              </div>
            </div>
            <p className="text-sm text-white/50">
              Initialize the agent with your private key and submit inference jobs.
            </p>
          </GlassCard>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Layers className="w-4 h-4 text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold">Local Server</h3>
            </div>
            <div className="relative bg-black/40 rounded-xl border border-white/10 p-4 mb-4 overflow-x-auto">
              <pre className="text-sm font-mono text-white/80">
                <code>{SERVER_SNIPPET}</code>
              </pre>
              <div className="absolute top-3 right-3">
                <CopyButton text={SERVER_SNIPPET} />
              </div>
            </div>
            <p className="text-sm text-white/50">
              Run a local REST server to submit jobs via HTTP endpoints.
            </p>
          </GlassCard>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Code2 className="w-4 h-4 text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold">CLI Commands</h3>
            </div>
            <div className="space-y-3">
              {[
                { cmd: 'blindference-agent infer --prompt "Hello"', desc: 'Run a single inference' },
                { cmd: 'blindference-agent balance', desc: 'Check credit balances' },
                { cmd: 'blindference-agent buy-package --id pro', desc: 'Purchase a credit package' },
              ].map(({ cmd, desc }) => (
                <div key={cmd} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <Terminal className="w-4 h-4 text-white/30 shrink-0" />
                    <div className="min-w-0">
                      <code className="text-xs font-mono text-orange-300/80 truncate block">{cmd}</code>
                      <span className="text-xs text-white/40">{desc}</span>
                    </div>
                  </div>
                  <CopyButton text={cmd} className="shrink-0" />
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>

      {/* Recent SDK Jobs Table */}
      {hasSdkJobs && stats && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="mt-8"
        >
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">SDK Job History</h3>
              <Badge variant="warning">SDK</Badge>
            </div>
            <div className="text-sm text-white/50 text-center py-8">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-white/30" />
              <p>Job history integration coming soon.</p>
              <p className="text-xs text-white/30 mt-1">
                Jobs submitted via the SDK are tracked in the Payment Service. Full history display will be available in a future update.
              </p>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </div>
  )
}
