import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Server,
  Terminal,
  ArrowUpRight,
  ChevronRight,
  Download,
  Settings,
  Coins,
  Cpu,
} from 'lucide-react'
import { FeatureCard } from '../components/effects/FeatureCard'
import { GlowDivider } from '../components/effects/GlowDivider'
import { fadeInUp, fadeInScale, staggerSlow } from '../lib/animations'

/* ─── Aurora background orbs ─── */
function AuroraBlobs() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <motion.div
        animate={{
          x: [0, 80, -40, 0],
          y: [0, -60, 40, 0],
          scale: [1, 1.15, 0.9, 1],
        }}
        transition={{ duration: 25, ease: 'linear', repeat: Infinity }}
        className="absolute top-[15%] left-[10%] w-[50vw] h-[50vw] rounded-full bg-violet-500/[0.03] blur-[120px]"
      />
      <motion.div
        animate={{
          x: [0, -60, 30, 0],
          y: [0, 40, -50, 0],
          scale: [1, 0.85, 1.1, 1],
        }}
        transition={{ duration: 30, ease: 'linear', repeat: Infinity }}
        className="absolute bottom-[10%] right-[5%] w-[40vw] h-[40vw] rounded-full bg-indigo-500/[0.02] blur-[140px]"
      />
      <motion.div
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
        }}
        transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
        className="absolute top-[50%] left-[50%] w-[30vw] h-[30vw] rounded-full bg-white/[0.01] blur-[100px]"
      />
    </div>
  )
}

/* ─── Step card with code block inside ─── */
function StepCard({
  step,
  icon: Icon,
  title,
  code,
  accentColor,
  glowColor,
}: {
  step: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  code: string
  accentColor: string
  glowColor: string
}) {
  return (
    <motion.div variants={fadeInScale} className="relative group">
      {/* Animated border glow */}
      <div
        className={`absolute -inset-[1px] rounded-2xl opacity-100 transition-all duration-700 blur-sm ${glowColor}`}
      />

      <div className="relative p-5 lg:p-6 rounded-2xl bg-[#080808]/80 backdrop-blur-sm border border-white/[0.12] transition-all duration-700 h-full overflow-hidden hover:border-white/[0.18]">
        {/* Top shimmer line */}
        <div
          className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${accentColor} to-transparent opacity-100 transition-opacity duration-700`}
        />

        {/* Corner glow */}
        <div
          className={`absolute -top-16 -right-16 w-32 h-32 rounded-full ${glowColor} opacity-60 transition-opacity duration-700 blur-3xl`}
        />

        {/* Step badge */}
        <div className="flex items-center gap-2.5 mb-4">
          <div
            className={`w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.15] flex items-center justify-center group-hover:scale-110 transition-all duration-500`}
          >
            <Icon
              className={`w-4 h-4 ${accentColor.replace('/50', '').replace('/40', '').replace('bg-', 'text-')}`}
            />
          </div>
          <span className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.2em]">
            {step}
          </span>
        </div>

        <h3 className="text-sm font-bold mb-3 text-white tracking-tight">{title}</h3>
        <pre className="text-xs font-mono text-white/50 whitespace-pre leading-relaxed">
          {code}
        </pre>
      </div>
    </motion.div>
  )
}

/* ─── Premium button with shimmer ─── */
function PremiumButton({
  children,
  href,
  external = false,
  icon: Icon,
}: {
  children: React.ReactNode
  href: string
  external?: boolean
  icon?: React.ComponentType<{ className?: string }>
}) {
  const className =
    'group relative inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold overflow-hidden transition-all duration-400 hover:scale-[1.03]'

  const content = (
    <>
      {Icon && <Icon className="w-4 h-4 relative z-10" />}
      <span className="relative z-10">{children}</span>
      <span className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
    </>
  )

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} border border-white/15 bg-white/[0.04] text-white/80 hover:border-violet-400/25 hover:bg-white/[0.08] hover:text-white`}
      >
        {content}
        <ArrowUpRight className="w-4 h-4 relative z-10 text-white/50 group-hover:text-white transition-colors" />
      </a>
    )
  }

  return (
    <Link
      to={href}
      className={`${className} bg-white text-black hover:bg-violet-50 shadow-[0_4px_20px_rgba(139,92,246,0.3)] hover:shadow-[0_8px_30px_rgba(139,92,246,0.5)]`}
    >
      {content}
    </Link>
  )
}

export function NodeRegistrationPage() {
  return (
    <div className="relative min-h-[calc(100vh-5rem)] flex items-center justify-center px-6 py-16 overflow-hidden">
      {/* Background effects */}
      <AuroraBlobs />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      <div className="relative z-10 w-full max-w-3xl">
        {/* Glow divider above */}
        <GlowDivider />

        <motion.div
          variants={staggerSlow}
          initial="hidden"
          animate="show"
          className="py-12"
        >
          {/* Main card */}
          <motion.div
            variants={fadeInUp}
            className="relative group"
           
          >
            {/* Card border glow */}
            <div className="absolute -inset-[1px] rounded-[2.5rem] bg-violet-500/10 blur-sm opacity-100" />

            <div className="relative rounded-[2.5rem] bg-[#0a0a0a]/90 backdrop-blur-sm border border-white/[0.08] p-10 md:p-14 text-center overflow-hidden">
              {/* Top shimmer */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />

              {/* Corner glow */}
              <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-violet-500/5 blur-3xl" />

              {/* Server icon with animated ring */}
              <motion.div
                variants={fadeInScale}
                className="mx-auto mb-8 relative"
              >
                <div className="absolute inset-0 rounded-2xl bg-violet-500/20 blur-xl animate-pulse" />
                <div className="relative w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.1] flex items-center justify-center">
                  <Server className="w-6 h-6 text-white/60" />
                </div>
              </motion.div>

              {/* Heading */}
              <motion.h1
                variants={fadeInUp}
                className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold font-heading mb-4 leading-tight tracking-tight"
              >
                <span className="text-white">Become a </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-violet-500 to-indigo-400 drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]">
                  Blindference
                </span>
                <span className="text-white"> Compute Node</span>
              </motion.h1>

              {/* Description */}
              <motion.p
                variants={fadeInUp}
                className="text-sm md:text-base text-white/50 leading-relaxed max-w-lg mx-auto mb-10"
              >
                Run confidential inference and earn{' '}
                <span className="text-white/80 font-medium">BLIND</span> rewards.
                Join the quorum network that powers private AI for the
                decentralized web.
              </motion.p>

              {/* CTAs */}
              <motion.div
                variants={fadeInUp}
                className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12"
               
              >
                <PremiumButton href="/docs/build/getting-started" icon={Terminal}>
                  Node Setup Guide
                </PremiumButton>
                <PremiumButton
                  href="https://pypi.org/project/blindference-node"
                  external
                >
                  PyPI Package
                </PremiumButton>
              </motion.div>

              {/* Three steps */}
              <motion.div
                variants={staggerSlow}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left"
               
              >
                <StepCard
                  step="1. Install"
                  icon={Download}
                  title="Install the package"
                  code={`pip install\nblindference-node`}
                  accentColor="bg-violet-500/50"
                  glowColor="bg-violet-500/10"
                />
                <StepCard
                  step="2. Configure"
                  icon={Settings}
                  title="Set up your node"
                  code={`Set wallet key\nand ICL endpoint`}
                  accentColor="bg-cyan-500/50"
                  glowColor="bg-cyan-500/10"
                />
                <StepCard
                  step="3. Earn"
                  icon={Coins}
                  title="Start earning"
                  code={`Run inference,\nverify, get paid`}
                  accentColor="bg-emerald-500/50"
                  glowColor="bg-emerald-500/10"
                />
              </motion.div>
            </div>
          </motion.div>

          {/* Bottom link */}
          <motion.div variants={fadeInUp} className="mt-8 text-center">
            <Link
              to="/docs/build/getting-started"
              className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors group"
            >
              View full node documentation
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>
        </motion.div>

        {/* Glow divider below */}
        <GlowDivider />
      </div>
    </div>
  )
}
