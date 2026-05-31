import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useCredits } from '../hooks/useCredits'
import { Wallet, ArrowDownLeft, ArrowUpRight, Droplets, RefreshCw, Loader2, Mail, Send, CheckCircle, AlertTriangle, Copy, ExternalLink, Server, Code, TrendingUp, ArrowRight } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { motion } from 'framer-motion'
import { fadeInUp } from '../lib/animations'
import { CopyButton } from '../components/ui/CopyButton'
import { Link } from 'react-router-dom'

/* ─── Helper Functions ─── */
function formatWei(wei: string | number): string {
  try {
    const n = BigInt(wei)
    return n.toLocaleString()
  } catch {
    return String(wei)
  }
}

function weiToEth(wei: string | number): string {
  try {
    const n = BigInt(wei)
    return (Number(n) / 1e18).toFixed(2)
  } catch {
    return "0"
  }
}

function timeAgo(dateStr: string): string {
  return dateStr
}

/* ─── Mock Transaction Data ─── */
const MOCK_TRANSACTIONS = [
  { type: 'Deposit', token: 'cUSDC', amount: '+5,000', date: '2 min ago', status: 'Completed' as const, txHash: '0x7f8a9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b' },
  { type: 'Wrap', token: 'USDC→cUSDC', amount: '+1,000', date: '1 hour ago', status: 'Completed' as const, txHash: '0x9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c' },
  { type: 'Package Buy', token: 'BLIND', amount: '-2,500', date: '3 hours ago', status: 'Completed' as const, txHash: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b' },
  { type: 'Faucet', token: 'BLIND', amount: '+1,000', date: '1 day ago', status: 'Completed' as const, txHash: '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c' },
  { type: 'Inference', token: 'cUSDC', amount: '-500', date: '2 days ago', status: 'Completed' as const, txHash: '0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d' },
]

/* ─── Components ─── */

function SectionLabel({ text }: { text: string }) {
  return (
    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-2">
      {text}
    </div>
  )
}

function StatusBadge({ status }: { status: 'Completed' | 'Pending' }) {
  const isCompleted = status === 'Completed'
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${isCompleted ? 'bg-green-400' : 'bg-violet-400'} ${isCompleted ? '' : 'animate-pulse'}`} />
      <span className={`text-xs font-medium ${isCompleted ? 'text-green-400' : 'text-violet-400'}`}>
        {status}
      </span>
    </div>
  )
}

function TruncatedHash({ hash }: { hash: string }) {
  const truncated = `${hash.slice(0, 6)}...${hash.slice(-4)}`
  return (
    <div className="flex items-center gap-1.5 group">
      <span className="font-mono text-xs text-white/40">{truncated}</span>
      <CopyButton text={hash} title="Copy tx hash" className="text-white/20 group-hover:text-white/60" />
    </div>
  )
}

function ContactCard({
  icon: Icon,
  title,
  text,
  mailto,
  buttonText,
}: {
  icon: React.ElementType
  title: string
  text: string
  mailto: string
  buttonText: string
}) {
  return (
    <GlassCard className="gradient-accent-top p-6 hover:-translate-y-1 transition-all duration-300">
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-violet-400" />
          </div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        <p className="text-sm text-white/50 leading-relaxed mb-6 flex-grow">{text}</p>
        <a
          href={mailto}
          className="btn-outline inline-flex items-center justify-center gap-2 w-full group"
        >
          <span>{buttonText}</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </a>
      </div>
    </GlassCard>
  )
}

/* ─── Main Page ─── */
export function WalletPage() {
  const { address, isConnected } = useAccount()
  const { cusdc, blind, loading: balanceLoading, error: balanceError, refresh } = useCredits(address)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('General')
  const [message, setMessage] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const mailtoLink = `mailto:contact@blindference.xyz?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`)}`
    window.location.href = mailtoLink
  }

  const isPositive = (amount: string) => amount.startsWith('+')

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* ─── Header ─── */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className="mb-10"
      >
        <div className="flex items-center gap-3 mb-2">
          <Wallet className="w-8 h-8 text-violet-400" />
          <h1 className="text-4xl font-bold">
            Your{' '}
            <span className="gradient-text">Wallet</span>
          </h1>
        </div>
        <p className="text-white/50 text-base max-w-xl">
          Manage your cUSDC and BLIND balances, view transaction history, and get support.
        </p>
      </motion.div>

      {/* ─── Balance Overview ─── */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12"
       
      >
        {/* cUSDC Balance Card */}
        <GlassCard className="gradient-accent-top p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <SectionLabel text="CUSDC BALANCE" />
              <button
                onClick={() => refresh()}
                disabled={balanceLoading}
                className="p-2 rounded-full hover:bg-white/5 transition-colors disabled:opacity-50"
                title="Refresh balances"
              >
                {balanceLoading ? <Loader2 className="w-4 h-4 text-white/40 animate-spin" /> : <RefreshCw className="w-4 h-4 text-white/40" />}
              </button>
            </div>
            <div className="text-4xl font-bold text-white mb-2">
              {balanceError ? (
                <span className="text-red-400 text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Error loading balance
                </span>
              ) : (
                <span className="gradient-text">{formatWei(cusdc)}</span>
              )}
            </div>
            <p className="text-sm text-white/40 mb-8">Confidential USDC for inference payments</p>
            <div className="flex items-center gap-3">
              <Link
                to="/buy-credits"
                className="btn-primary inline-flex items-center gap-2"
              >
                <ArrowDownLeft className="w-4 h-4" />
                Wrap USDC
              </Link>
              <button
                disabled
                className="btn-outline inline-flex items-center gap-2 opacity-50 cursor-not-allowed"
              >
                <ArrowUpRight className="w-4 h-4" />
                Deposit
              </button>
            </div>
          </div>
        </GlassCard>

        {/* BLIND Balance Card */}
        <GlassCard className="gradient-accent-top p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <SectionLabel text="BLIND BALANCE" />
              <button
                onClick={() => refresh()}
                disabled={balanceLoading}
                className="p-2 rounded-full hover:bg-white/5 transition-colors disabled:opacity-50"
                title="Refresh balances"
              >
                {balanceLoading ? <Loader2 className="w-4 h-4 text-white/40 animate-spin" /> : <RefreshCw className="w-4 h-4 text-white/40" />}
              </button>
            </div>
            <div className="text-4xl font-bold text-white mb-2">
              {balanceError ? (
                <span className="text-red-400 text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Error loading balance
                </span>
              ) : (
                <span className="gradient-text">{weiToEth(blind)}</span>
              )}
            </div>
            <p className="text-sm text-white/40 mb-8">Protocol token for staking and rewards</p>
            <div className="flex items-center gap-3">
              <Link
                to="/buy-credits"
                className="btn-primary inline-flex items-center gap-2"
              >
                <Droplets className="w-4 h-4" />
                Drip
              </Link>
              <button
                disabled
                className="btn-outline inline-flex items-center gap-2 opacity-50 cursor-not-allowed"
              >
                <CheckCircle className="w-4 h-4" />
                Stake
              </button>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ─── Section Divider ─── */}
      <div className="section-divider my-12" />

      {/* ─── Transaction History ─── */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className="mb-12"
       
      >
        <div className="flex items-center justify-between mb-6">
          <SectionLabel text="TRANSACTION HISTORY" />
          <span className="text-xs text-white/30">Last 5 transactions</span>
        </div>

        <div className="space-y-2">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[140px_120px_100px_100px_100px_1fr] gap-4 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.15em] text-white/30">
            <span>Type</span>
            <span>Token</span>
            <span>Amount</span>
            <span>Date</span>
            <span>Status</span>
            <span>Tx Hash</span>
          </div>

          {/* Table Rows */}
          {MOCK_TRANSACTIONS.map((tx, idx) => (
            <motion.div
              key={tx.txHash}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.4, ease: 'easeOut' }}
              className="glass-card glass-card-hover px-4 py-3 grid grid-cols-2 md:grid-cols-[140px_120px_100px_100px_100px_1fr] gap-4 items-center"
            >
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-lg ${isPositive(tx.amount) ? 'bg-green-500/10 text-green-400' : 'bg-violet-500/10 text-violet-400'}`}>
                  {isPositive(tx.amount) ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                </span>
                <span className="text-sm font-medium text-white">{tx.type}</span>
              </div>
              <span className="text-sm text-white/60">{tx.token}</span>
              <span className={`text-sm font-mono font-semibold ${isPositive(tx.amount) ? 'text-green-400' : 'text-violet-400'}`}>
                {tx.amount}
              </span>
              <span className="text-xs text-white/40">{timeAgo(tx.date)}</span>
              <StatusBadge status={tx.status} />
              <div className="col-span-2 md:col-span-1">
                <TruncatedHash hash={tx.txHash} />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ─── Section Divider ─── */}
      <div className="section-divider my-12" />

      {/* ─── Contact / Support Section ─── */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className="mb-12"
      >
        <div className="text-center mb-2">
          <h2 className="text-3xl font-bold text-white mb-2">Need Help?</h2>
          <p className="text-white/50 text-base max-w-lg mx-auto">
            We're here for node operators, agent developers, and token holders.
          </p>
        </div>

        {/* Three Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-10">
          <ContactCard
            icon={Server}
            title="Running a Node?"
            text="Get help with attestation, staking, and reward issues."
            mailto="mailto:nodeops@blindference.xyz?subject=Node%20Operator%20Support"
            buttonText="Contact Node Team"
          />
          <ContactCard
            icon={Code}
            title="Building Agents?"
            text="Questions about the @abhieren/blindference-agent integration."
            mailto="mailto:agents@blindference.xyz?subject=Agent%20SDK%20Support"
            buttonText="Contact Dev Team"
          />
          <ContactCard
            icon={TrendingUp}
            title="BLIND Tokenomics?"
            text="Learn about staking rewards, slashing, and protocol fees."
            mailto="mailto:tokenomics@blindference.xyz?subject=BLIND%20Tokenomics%20Question"
            buttonText="Contact Econ Team"
          />
        </div>

        {/* Quick Message Form */}
        <GlassCard className="gradient-border p-8 relative">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <Mail className="w-6 h-6 text-violet-400" />
              <h3 className="text-xl font-bold text-white">Or send a quick message</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-2">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="input-glass w-full px-4 py-3 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input-glass w-full px-4 py-3 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-2">Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input-glass w-full px-4 py-3 text-sm appearance-none cursor-pointer"
                >
                  <option value="General" className="bg-[#0a0a0a]">General</option>
                  <option value="Node Operator" className="bg-[#0a0a0a]">Node Operator</option>
                  <option value="Agent SDK" className="bg-[#0a0a0a]">Agent SDK</option>
                  <option value="Tokenomics" className="bg-[#0a0a0a]">Tokenomics</option>
                  <option value="Bug Report" className="bg-[#0a0a0a]">Bug Report</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mb-2">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help you?"
                  rows={4}
                  className="input-glass w-full px-4 py-3 text-sm resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary inline-flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send Message
              </button>
            </form>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  )
}
