import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Shield,
  Lock,
  Cpu,
  Globe,
  ArrowRight,
  ChevronDown,
  Zap,
  CheckCircle2,
  Server,
  Users,
  FileText,
  Wallet,
  Database,
  Layers,
  HardDrive,
  Code2,
} from 'lucide-react'
import { fadeInUp, fadeInScale, staggerSlow } from '../lib/animations'
import DottedGlobe from '../components/globe/DottedGlobe'
import HowItWorks from '../components/landing/HowItWorks'
import PrivacyMarquee from '../components/landing/PrivacyMarquee'
import AnimatedBanner from '../components/landing/AnimatedBanner'
import ArchitectureDiagram from '../components/landing/ArchitectureDiagram'
import ModelShowcase from '../components/landing/ModelShowcase'
import { PrivacyComparison } from '../components/landing/PrivacyComparison'
import { RolesSection } from '../components/landing/RolesSection'
import { FinalCTA } from '../components/landing/FinalCTA'

/* ─── Cursor-tracking grid background ─── */
function CursorGrid() {
  const gridRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: -100, y: -100 })

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!gridRef.current) return
      const rect = gridRef.current.getBoundingClientRect()
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  return (
    <div
      ref={gridRef}
      className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
    >
      {/* Base faint grid */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      {/* Grid intersection glow dots */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle 2px at calc(var(--gx, 0px) + 1px) calc(var(--gy, 0px) + 1px), rgba(249,115,22,0.6) 0%, transparent 100%), radial-gradient(circle 2px at calc(var(--gx, 0px) + 61px) calc(var(--gy, 0px) + 61px), rgba(249,115,22,0.6) 0%, transparent 100%), radial-gradient(circle 2px at calc(var(--gx, 0px) + 1px) calc(var(--gy, 0px) + 61px), rgba(249,115,22,0.6) 0%, transparent 100%), radial-gradient(circle 2px at calc(var(--gx, 0px) + 61px) calc(var(--gy, 0px) + 1px), rgba(249,115,22,0.6) 0%, transparent 100%)',
          backgroundSize: '120px 120px',
          backgroundPosition: `${-pos.x % 120}px ${-pos.y % 120}px`,
          filter: 'blur(0.5px)',
        }}
      />

      {/* Orange glow near cursor */}
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background: `radial-gradient(500px circle at ${pos.x}px ${pos.y}px, rgba(249,115,22,0.28), rgba(249,115,22,0.08) 35%, transparent 65%)`,
        }}
      />
    </div>
  )
}

/* ─── Hero ─── */
function HeroSection() {
  return (
    <section className="relative min-h-[60vh] lg:min-h-[70vh] flex items-center overflow-hidden">
      <CursorGrid />

      {/* Scanline effect */}
      <div
        className="absolute inset-0 z-[2] pointer-events-none opacity-[0.04]"
        style={{
          background: 'linear-gradient(to bottom, transparent 50%, rgba(249, 115, 22, 0.03) 51%, transparent 100%)',
          backgroundSize: '100% 4px',
        }}
      />

      <div className="relative z-10 w-full px-6 md:px-12 lg:px-24 pt-24 pb-12">
        <motion.div
          variants={staggerSlow}
          initial="hidden"
          animate="show"
          className="mx-auto flex max-w-7xl flex-col lg:flex-row items-center gap-10 lg:gap-4"
        >
          {/* Text content - centered */}
          <div className="flex-1 flex flex-col items-center text-center max-w-2xl">
            <motion.div variants={fadeInUp}>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 mb-6">
                <Zap className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-medium text-orange-300 tracking-wide">
                  CoFHE-Powered Confidential AI
                </span>
              </div>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-[3.3rem] font-black leading-[0.9] tracking-[-0.06em] sm:text-[3.9rem] md:text-7xl lg:text-[5rem] xl:text-[5.2rem] mb-6"
            >
              <span className="block text-white">Confidential AI</span>
              <span className="block mt-1">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-orange-500 to-orange-400 drop-shadow-[0_0_30px_rgba(249,115,22,0.3)]">Inference,</span>{' '}
                <span className="text-stroke" style={{ WebkitTextStroke: '1.5px rgba(255,255,255,0.1)', color: 'transparent' }}>Verified.</span>
              </span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="max-w-xl text-lg md:text-xl font-light leading-relaxed tracking-wide text-white/40 mb-8"
            >
              Your prompts are encrypted with <span className="text-white/80 font-medium border-b border-orange-500/30">FHE</span>.
              Your answers are proven by <span className="text-white/80 font-medium border-b border-orange-500/30">quorum consensus</span> inside TEEs.
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row items-center gap-4"
            >
              <Link
                to="/app"
                className="inline-flex items-center gap-2 bg-white text-black font-bold text-sm rounded-full px-8 py-3.5 transition-all hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)]"
              >
                Launch App
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/docs"
                className="inline-flex items-center gap-2 glass-card glass-card-hover text-orange-300 font-semibold text-sm rounded-full px-8 py-3.5 border border-white/10"
              >
                Read Docs
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              variants={fadeInUp}
              className="mt-8 flex flex-wrap justify-center gap-3"
            >
              {['100% Private', 'ZK Native', 'FHE Protected', 'Quorum Verified'].map(
                (label) => (
                  <div
                    key={label}
                    className="group inline-flex items-center gap-2 rounded-full bg-white/[0.03] border border-white/[0.06] hover:border-orange-500/20 px-4 py-2 text-xs text-white/40 transition-all duration-500 backdrop-blur-xl cursor-default"
                  >
                    <span className="text-[10px] font-mono tracking-[0.25em] text-white/40 group-hover:text-white transition-colors uppercase font-bold">{label}</span>
                  </div>
                )
              )}
            </motion.div>
          </div>

          {/* Globe - right */}
          <motion.div
            variants={fadeInUp}
            className="hidden lg:block flex-1 relative"
          >
            <div className="absolute right-[-18rem] top-1/2 -translate-y-1/2 opacity-80 lg:right-[-12%] xl:right-[-4%]">
              <DottedGlobe className="w-[26rem] max-w-none sm:w-[30rem] md:w-[34rem] lg:w-[38rem] xl:w-[42rem]" />
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />
    </section>
  )
}



/* ─── Feature bento grid ─── */
function FeaturesSection() {
  const features = [
    {
      icon: Lock,
      title: 'End-to-End Encryption',
      desc: 'AES-256-GCM + CoFHE threshold encryption ensures only the quorum can access your prompts.',
    },
    {
      icon: CheckCircle2,
      title: 'Quorum Consensus',
      desc: '1 leader + 2 verifiers run the same inference. Mismatches trigger automatic dispute resolution.',
    },
    {
      icon: Shield,
      title: 'On-Chain Insurance',
      desc: 'Optional hallucination coverage via Reineira. Disputed results trigger USDC payouts.',
    },
    {
      icon: Server,
      title: 'Decentralized Nodes',
      desc: 'Anyone can run a compute node. Attestation, staking, and slashing keep the network honest.',
    },
    {
      icon: Wallet,
      title: 'Pay Per Inference',
      desc: 'Use cUSDC credits or create an escrow. No subscriptions, no hidden fees.',
    },
    {
      icon: Database,
      title: 'IPFS Storage',
      desc: 'Encrypted prompts stored on IPFS via Pinata. Decentralized, immutable, always available.',
    },
  ]

  return (
    <section className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-3xl sm:text-4xl font-bold font-heading text-brand-text mb-4">
            Built for <span className="gradient-text">Privacy</span>
          </h2>
          <p className="text-brand-text-secondary max-w-xl mx-auto">
            Every layer of the stack is designed to keep your data confidential
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              variants={fadeInScale}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="glass-card glass-card-hover p-6 h-full">
                <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/15 flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-brand-secondary" />
                </div>
                <h3 className="text-base font-bold text-brand-text mb-2 font-heading">
                  {feature.title}
                </h3>
                <p className="text-sm text-brand-text-secondary leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Partners ─── */
function PartnersSection() {
  const partners = [
    { name: 'Arbitrum', abbr: 'Arb' },
    { name: 'Fhenix', abbr: 'Fh' },
    { name: 'Reineira', abbr: 'Re' },
  ]

  return (
    <section className="relative py-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <motion.p
          variants={fadeInUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="text-xs uppercase tracking-[0.3em] text-brand-text-secondary mb-10"
        >
          Built on
        </motion.p>

        <motion.div
          variants={staggerSlow}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="flex flex-wrap items-center justify-center gap-8 sm:gap-12"
        >
          {partners.map((partner) => (
            <motion.div
              key={partner.name}
              variants={fadeInScale}
              whileHover={{ scale: 1.05, opacity: 1 }}
              className="text-brand-text-secondary/50 hover:text-brand-text transition-all cursor-default"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-xs font-bold text-brand-highlight">
                  {partner.abbr}
                </div>
                <span className="text-sm font-medium">{partner.name}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="relative border-t border-brand-primary/10 px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-brand-primary text-white font-extrabold text-sm flex items-center justify-center glow-primary">
                B
              </div>
              <span className="font-semibold text-sm tracking-[0.2em] text-brand-text font-heading">
                BLINDFERENCE
              </span>
            </div>
            <p className="text-xs text-brand-text-secondary leading-relaxed">
              Confidential AI inference, verified by quorum, settled on-chain.
            </p>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wider text-brand-text mb-4 font-semibold">
              Product
            </h4>
            <div className="space-y-2">
              <Link
                to="/app"
                className="block text-sm text-brand-text-secondary hover:text-brand-text transition-colors"
              >
                Inference
              </Link>
              <Link
                to="/history"
                className="block text-sm text-brand-text-secondary hover:text-brand-text transition-colors"
              >
                History
              </Link>
              <Link
                to="/buy-credits"
                className="block text-sm text-brand-text-secondary hover:text-brand-text transition-colors"
              >
                Credits
              </Link>
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wider text-brand-text mb-4 font-semibold">
              Network
            </h4>
            <div className="space-y-2">
              <Link
                to="/node-registration"
                className="block text-sm text-brand-text-secondary hover:text-brand-text transition-colors"
              >
                Run a Node
              </Link>
              <Link
                to="/node-dashboard"
                className="block text-sm text-brand-text-secondary hover:text-brand-text transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/docs"
                className="block text-sm text-brand-text-secondary hover:text-brand-text transition-colors"
              >
                Documentation
              </Link>
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wider text-brand-text mb-4 font-semibold">
              Connect
            </h4>
            <div className="space-y-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-brand-text-secondary hover:text-brand-text transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-brand-text-secondary hover:text-brand-text transition-colors"
              >
                X / Twitter
              </a>
              <a
                href="https://discord.com"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-brand-text-secondary hover:text-brand-text transition-colors"
              >
                Discord
              </a>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-brand-primary/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-brand-text-secondary/60">
            &copy; 2025 Blindference Labs. All rights reserved.
          </p>
          <p className="text-xs text-brand-text-secondary/60">
            Built with love for privacy.
          </p>
        </div>
      </div>
    </footer>
  )
}

/* ─── Page ─── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text relative overflow-hidden">
      {/* Nav */}
      <nav className="relative z-50 flex items-center justify-between px-6 sm:px-10 py-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-primary text-white font-extrabold text-sm flex items-center justify-center glow-primary">
            B
          </div>
          <span className="font-semibold text-sm tracking-[0.2em] text-brand-text font-heading">
            BLINDFERENCE
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 bg-white text-black font-bold text-xs rounded-full px-5 py-2.5 transition-all hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            Launch App
          </Link>
        </div>
      </nav>

      <main className="relative z-10">
        <HeroSection />
        <AnimatedBanner />
        <PrivacyMarquee />
        <HowItWorks />
        <FeaturesSection />
        <ArchitectureDiagram />
        <ModelShowcase />
        <PrivacyComparison />
        <RolesSection />
        <PartnersSection />
        <FinalCTA />
      </main>

      <Footer />
    </div>
  )
}
