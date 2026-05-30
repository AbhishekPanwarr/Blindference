import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Server,
  Terminal,
  Settings,
  Play,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Copy,
  Cpu,
  Wallet,
  Shield,
  Globe,
  Lock,
} from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { SectionLabel } from '../components/effects/GlowDivider'

const STEPS = [
  { id: 'overview', label: 'Overview', icon: Server },
  { id: 'install', label: 'Install', icon: Terminal },
  { id: 'init', label: 'Initialize', icon: Settings },
  { id: 'configure', label: 'Configure', icon: Lock },
  { id: 'stake', label: 'Stake BLIND', icon: Wallet },
  { id: 'run', label: 'Run & Verify', icon: Play },
]

const ENV_VARS = [
  { name: 'BLF_PRIVATE_KEY', required: true, desc: 'Node wallet private key' },
  { name: 'BLF_KEY_PASSWORD', required: true, desc: 'Wallet encryption password' },
  { name: 'BLF_ICL_ENDPOINT', required: true, desc: 'ICL API base URL (default: https://icl.blindference.xyz)' },
  { name: 'BLF_COFHE_MODE', required: false, desc: 'CoFHE client: mock | python | bridge (default: mock)' },
  { name: 'BLF_FHENIX_RPC', required: false, desc: 'Arbitrum Sepolia RPC for on-chain calls' },
  { name: 'BLF_LOG_LEVEL', required: false, desc: 'Logging verbosity: DEBUG | INFO | WARN (default: INFO)' },
  { name: 'BLF_STAKE_AMOUNT', required: false, desc: 'Stake amount in wei (0 = skip)' },
  { name: 'BLF_CONFIG_DIR', required: false, desc: 'Config directory for multi-node setups (default: ~/.blindference)' },
]

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative rounded-lg border border-white/10 bg-[rgba(10,10,10,0.6)] overflow-hidden">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 p-1.5 text-white/50 hover:text-white/90 transition-colors"
      >
        {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <pre className="p-4 text-xs font-mono text-white/90 overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  )
}

export function NodeRegistrationPage() {
  const [step, setStep] = useState(0)
  const StepIcon = STEPS[step].icon

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <SectionLabel>NODE REGISTRATION</SectionLabel>
            <h1 className="text-2xl font-semibold gradient-text font-heading mb-2 mt-1">Run a Blindference Node</h1>
            <p className="text-sm text-white/50">
              Join the quorum network and earn fees for verifiable, confidential inference execution.
            </p>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const isActive = i === step
              const isCompleted = i < step
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <button
                    onClick={() => setStep(i)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[rgba(10,10,10,0.6)] text-white/90 border border-white/10'
                        : isCompleted
                        ? 'text-white/50 hover:bg-orange-500/10'
                        : 'text-white/50 hover:bg-orange-500/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {s.label}
                  </button>
                  {i < STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-white/50" />}
                </div>
              )
            })}
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {step === 0 && (
                <>
                  <GlassCard className="gradient-accent-top p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-white/90 font-heading flex items-center gap-2">
                      <Server className="w-5 h-5 text-white/50" />
                      What is a Blindference Node?
                    </h2>
                    <p className="text-sm text-white/50 leading-relaxed">
                      Blindference nodes are the execution backbone of the network. Each inference job is assigned to
                      one <strong>leader</strong> node and two <strong>verifier</strong> nodes. The leader runs the
                      model, encrypts the output, and posts a commitment hash. Verifiers independently replay the
                      inference and compare hashes. 2/3 consensus is required for settlement.
                    </p>
                  </GlassCard>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        icon: Cpu,
                        title: 'GPU (Optional)',
                        desc: 'For local vLLM inference. Otherwise uses Groq/Gemini APIs.',
                      },
                      {
                        icon: Wallet,
                        title: 'Arbitrum Wallet',
                        desc: 'Needs testnet ETH for on-chain attestations and key storage.',
                      },
                      {
                        icon: Shield,
                        title: 'Stake Collateral',
                        desc: 'Economic bond that gets slashed if node produces bad output.',
                      },
                    ].map(({ icon: Icon, title, desc }) => (
                      <GlassCard
                        key={title}
                        className="p-4 space-y-2"
                        variant="light"
                      >
                        <Icon className="w-5 h-5 text-white/50" />
                        <h3 className="text-sm font-semibold text-white/90 font-heading">{title}</h3>
                        <p className="text-xs text-white/50 leading-relaxed">{desc}</p>
                      </GlassCard>
                    ))}
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <GlassCard className="gradient-accent-top p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-white/90 font-heading flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-white/50" />
                      Install the Node Package
                    </h2>
                    <p className="text-sm text-white/50">Install via pip or use the Docker image.</p>
                    <CodeBlock code={`# Via pip
pip install blindference-node

# Or clone and install from source
git clone https://github.com/baync180705/blindference-node.git
cd blindference-node
pip install -e ".[dev]"

# Verify installation
blindference-node --version`} />
                  </GlassCard>

                  <GlassCard className="gradient-accent-top p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white/90 font-heading">Docker (Alternative)</h3>
                    <CodeBlock code={`docker pull blindference/node:latest
docker run -it --gpus all -e BLF_PRIVATE_KEY=<KEY> blindference/node:latest init --non-interactive`} />
                  </GlassCard>
                </>
              )}

              {step === 2 && (
                <>
                  <GlassCard className="gradient-accent-top p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-white/90 font-heading flex items-center gap-2">
                      <Settings className="w-5 h-5 text-white/50" />
                      Initialize Your Node
                    </h2>
                    <p className="text-sm text-white/50">
                      The init command generates a wallet, detects GPU, runs attestation, and auto-registers with the
                      ICL as an operator.
                    </p>
                    <CodeBlock code={`# Interactive init
blindference-node init

# Non-interactive (for scripts / Docker)
BLF_PRIVATE_KEY=0x... BLF_KEY_PASSWORD=secret blindference-node init --non-interactive`} />
                  </GlassCard>

                  <GlassCard className="gradient-accent-top p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white/90 font-heading">What init does</h3>
                    <ul className="space-y-2 text-sm text-white/50">
                      {[
                        'Generates or imports an Ethereum wallet',
                        'Detects GPU via nvidia-smi (optional)',
                        'Runs mock attestation (HMAC-SHA256)',
                        'Auto-registers as operator with ICL',
                        'Creates ~/.blindference/ config directory',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-white/50 mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </GlassCard>
                </>
              )}

              {step === 3 && (
                <>
                  <GlassCard className="gradient-accent-top p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-white/90 font-heading flex items-center gap-2">
                      <Lock className="w-5 h-5 text-white/50" />
                      Environment Configuration
                    </h2>
                    <p className="text-sm text-white/50">
                      Create a <code className="text-white/90 bg-[rgba(10,10,10,0.6)] px-1 py-0.5 rounded">.env</code> file in your
                      working directory or under <code className="text-white/90 bg-[rgba(10,10,10,0.6)] px-1 py-0.5 rounded">~/.blindference/.env</code>.
                    </p>
                  </GlassCard>

                  <GlassCard className="overflow-hidden">
                    <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-3 border-b border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/50">
                      <span>Variable</span>
                      <span>Description</span>
                      <span>Required</span>
                    </div>
                    {ENV_VARS.map((v) => (
                      <div
                        key={v.name}
                        className="grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-3 border-b border-white/10 text-xs items-center"
                      >
                        <span className="font-mono text-white/90">{v.name}</span>
                        <span className="text-white/50">{v.desc}</span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            v.required ? 'text-white/90' : 'text-white/50'
                          }`}
                        >
                          {v.required ? 'Yes' : 'No'}
                        </span>
                      </div>
                    ))}
                  </GlassCard>

                  <CodeBlock code={`# Example .env file
BLF_PRIVATE_KEY=0x7d7c7446203f1f6216055930a7602a69807c9b2db6e94b78e4eb93b5925265e0
BLF_KEY_PASSWORD=mock
BLF_ICL_ENDPOINT=https://icl.blindference.xyz
BLF_COFHE_MODE=mock
BLF_FHENIX_RPC=https://sepolia-rollup.arbitrum.io/rpc
BLF_LOG_LEVEL=INFO
BLF_STAKE_AMOUNT=0`} />
                </>
              )}

              {step === 4 && (
                <>
                  <GlassCard className="gradient-accent-top p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-white/90 font-heading flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-white/50" />
                      Stake BLIND Tokens
                    </h2>
                    <p className="text-sm text-white/50">
                      Nodes must stake at least <strong>1000 BLIND</strong> to participate in inference quorums. Staking
                      provides economic security — stake is slashed if a node produces incorrect output or times out.
                    </p>
                  </GlassCard>

                  <GlassCard className="gradient-accent-top p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white/90 font-heading">Stake Commands</h3>
                    <CodeBlock code={`# Stake 1000 BLIND (minimum)
blindference-node staking stake 1000

# Check your stake status
blindference-node staking status

# Initiate unstake (starts 96h unbonding)
blindference-node staking unstake

# Complete unstake after unbonding period
blindference-node staking withdraw`} />
                  </GlassCard>

                  <GlassCard className="gradient-accent-top p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white/90 font-heading">Staking Economics</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {[
                        { title: 'Minimum Stake', value: '1,000 BLIND' },
                        { title: 'Unbonding Period', value: '96 hours' },
                        { title: 'Reward per Job', value: '1 BLIND (60% leader, 20% each verifier)' },
                      ].map((item) => (
                        <GlassCard key={item.title} className="p-3" variant="light">
                          <div className="text-white/50 mb-1">{item.title}</div>
                          <div className="text-white/90 font-medium">{item.value}</div>
                        </GlassCard>
                      ))}
                    </div>
                  </GlassCard>

                  <GlassCard className="gradient-accent-top p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white/90 font-heading">Slashing Conditions</h3>
                    <ul className="space-y-2 text-xs text-white/50">
                      {[
                        'Timeout — no result within 5 minutes → +1 failure strike',
                        '3 consecutive failures → entire stake is hard-slashed on-chain',
                        'Successful job completion resets failure count to 0',
                        'Soft exclusion — nodes with ≥3 failures are excluded from quorum selection',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Shield className="w-4 h-4 text-white/50 mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </GlassCard>
                </>
              )}

              {step === 5 && (
                <>
                  <GlassCard className="gradient-accent-top p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-white/90 font-heading flex items-center gap-2">
                      <Play className="w-5 h-5 text-white/50" />
                      Run & Verify
                    </h2>
                    <p className="text-sm text-white/50">
                      Start the daemon. It runs three concurrent loops: heartbeat (60s), attestation watchdog (10min),
                      and assignment poller (5s).
                    </p>
                    <CodeBlock code={`# Start the node daemon
blindference-node run

# In another terminal, verify ICL health
curl http://localhost:8000/health

# Test determinism (requires vLLM + GPU)
blindference-node test-determinism`} />
                  </GlassCard>

                  <GlassCard className="gradient-accent-top p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white/90 font-heading">Multi-Node Local Setup</h3>
                    <p className="text-xs text-white/50">
                      Run 3 nodes on one machine using <code className="text-white/90">BLF_CONFIG_DIR</code> isolation:
                    </p>
                    <CodeBlock code={`# Terminal 1 - Leader
BLF_CONFIG_DIR=~/.blindference-node1 \
BLF_PRIVATE_KEY=0x7d7c7446203f1f6216055930a7602a69807c9b2db6e94b78e4eb93b5925265e0 \
blindference-node init --non-interactive && blindference-node run

# Terminal 2 - Verifier 1
BLF_CONFIG_DIR=~/.blindference-node2 \
BLF_PRIVATE_KEY=0x80d9375ef4683c4729d358c62608502b23fc3c33a7de0faa80178ed9735b1daa \
blindference-node init --non-interactive && blindference-node run

# Terminal 3 - Verifier 2
BLF_CONFIG_DIR=~/.blindference-node3 \
BLF_PRIVATE_KEY=0x377fb575b4f0c39f52e343865d24a4e358104719d6980b56060c80d28fb29fea \
blindference-node init --non-interactive && blindference-node run`} />
                  </GlassCard>

                  <GlassCard className="gradient-accent-top p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-white/90 font-heading">Debug Checklist</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {[
                        { q: 'Could not reach ICL', a: 'ICL running? curl http://localhost:8000/health' },
                        { q: 'Incorrect password', a: 'BLF_KEY_PASSWORD set in .env?' },
                        { q: 'FHE key/CRS error', a: 'TFHE version in node_modules/tfhe/ must be 1.5.3' },
                        { q: 'Quorum preview 400', a: 'At least 3 nodes with valid attestation + heartbeat?' },
                        { q: 'Assignment poll empty', a: 'Any jobs created? Check ICL logs or frontend' },
                        { q: 'CoFHE decrypt fails', a: 'BLF_COFHE_MODE=bridge? npm install for bridge scripts?' },
                      ].map((item) => (
                        <GlassCard key={item.q} className="p-3" variant="light">
                          <div className="text-white/50 font-medium mb-1">{item.q}</div>
                          <div className="text-white/50">{item.a}</div>
                        </GlassCard>
                      ))}
                    </div>
                  </GlassCard>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-sm text-white/50 hover:bg-orange-500/10 transition-colors disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === step ? 'bg-orange-500' : i < step ? 'bg-white/50' : 'bg-[rgba(10,10,10,0.6)]'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))}
              disabled={step === STEPS.length - 1}
              className="flex items-center gap-2 px-4 py-2 rounded-lg btn-primary text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
