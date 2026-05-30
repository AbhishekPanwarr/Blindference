import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Shield,
  Lock,
  Cpu,
  ArrowRight,
  Zap,
  CheckCircle2,
  Server,
  Wallet,
  Database,
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
import HeroGrid from '../components/effects/HeroGrid'
import { GrainOverlay } from '../components/effects/GrainOverlay'
import { GlowDivider, SectionLabel } from '../components/effects/GlowDivider'
import { FeatureCard } from '../components/effects/FeatureCard'

/* ─── Scanline CRT effect ─── */
function Scanlines() {
  return (
    <div
      className="absolute inset-0 z-[2] pointer-events-none opacity-[0.04]"
      style={{
        background:
          'linear-gradient(to bottom, transparent 50%, rgba(249, 115, 22, 0.03) 51%, transparent 100%)',
        backgroundSize: '100% 4px',
      }}
    />
  )
}

/* ─── Aurora blobs behind hero ─── */
function AuroraBlobs() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1]">
      <motion.div
        animate={{
          x: [0, 100, -60, 0],
          y: [0, -60, 80, 0],
          scale: [1, 1.15, 0.9, 1],
        }}
        transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
        className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full bg-orange-500/5 blur-[120px]"
      />
      <motion.div
        animate={{
          x: [0, -80, 40, 0],
          y: [0, 40, -60, 0],
          scale: [1, 0.85, 1.1, 1],
        }}
        transition={{ duration: 25, ease: 'linear', repeat: Infinity }}
        className="absolute top-[40%] right-[10%] w-[400px] h-[400px] rounded-full bg-white/3 blur-[100px]"
      />
    </div>
  )
}

/* ─── Hero ─── */
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background grid + aurora */}
      <HeroGrid />
      <AuroraBlobs />
      <Scanlines />

      {/* Globe as subtle background element */}
      <div className="absolute inset-0 z-[1] pointer-events-none flex items-center justify-center opacity-30 lg:opacity-40">
        <DottedGlobe className="w-[50rem] max-w-none lg:w-[60rem] xl:w-[70rem] scale-110" />
      </div>

      <div className="relative z-10 w-full px-6 md:px-12 pt-24 pb-12 flex flex-col items-center text-center">
        <motion.div
          variants={staggerSlow}
          initial="hidden"
          animate="show"
          className="max-w-3xl mx-auto"
        >
          <motion.div variants={fadeInUp}>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 mb-8">
              <Zap className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-medium text-orange-300 tracking-wide">
                CoFHE-Powered Confidential AI
              </span>
            </div>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-[3.3rem] font-black leading-[0.92] tracking-[-0.06em] sm:text-[3.9rem] md:text-7xl lg:text-[5.2rem] xl:text-[5.5rem] mb-8"
          >
            <span className="block text-white">Confidential AI</span>
            <span className="block mt-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-orange-500 to-orange-400 drop-shadow-[0_0_30px_rgba(249,115,22,0.3)]">
                Inference,
              </span>{' '}
              <span
                className="text-stroke-white"
                style={{
                  WebkitTextStroke: '1.5px rgba(255,255,255,0.12)',
                  color: 'transparent',
                }}
              >
                Verified.
              </span>
            </span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="max-w-xl mx-auto text-lg md:text-xl font-light leading-relaxed tracking-wide text-white/40 mb-10"
          >
            Your prompts are encrypted with{' '}
            <span className="text-white/80 font-medium border-b border-orange-500/30">
              FHE
            </span>
            . Your answers are proven by{' '}
            <span className="text-white/80 font-medium border-b border-orange-500/30">
              quorum consensus
            </span>{' '}
            inside TEEs.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              to="/app"
              className="btn-shimmer inline-flex items-center gap-2 bg-white text-black font-bold text-sm rounded-full px-8 py-3.5 transition-all hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)]"
            >
              Launch App
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 glass-panel glass-panel-hover text-orange-300 font-semibold text-sm rounded-full px-8 py-3.5 border border-white/10 transition-all hover:border-white/20"
            >
              Read Docs
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Trust badges — NullPay staggered TrustBar style */}
          <motion.div
            variants={fadeInUp}
            className="mt-10 flex flex-wrap justify-center gap-3"
          >
            {[
              '100% Private',
              'ZK Native',
              'FHE Protected',
              'Quorum Verified',
            ].map((label, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: 1 + i * 0.1,
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="group relative flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-orange-500/20 transition-all duration-500 backdrop-blur-xl cursor-default"
              >
                <span className="text-[10px] font-mono tracking-[0.25em] text-white/40 group-hover:text-white transition-colors uppercase font-bold">
                  {label}
                </span>
              </motion.div>
            ))}
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
      accentColor: 'bg-orange-500/50',
      glowColor: 'bg-orange-500/10',
    },
    {
      icon: CheckCircle2,
      title: 'Quorum Consensus',
      desc: '1 leader + 2 verifiers run the same inference. Mismatches trigger automatic dispute resolution.',
      accentColor: 'bg-orange-500/50',
      glowColor: 'bg-orange-500/10',
    },
    {
      icon: Shield,
      title: 'On-Chain Insurance',
      desc: 'Optional hallucination coverage via Reineira. Disputed results trigger USDC payouts.',
      accentColor: 'bg-orange-500/50',
      glowColor: 'bg-orange-500/10',
    },
    {
      icon: Server,
      title: 'Decentralized Nodes',
      desc: 'Anyone can run a compute node. Attestation, staking, and slashing keep the network honest.',
      accentColor: 'bg-orange-500/50',
      glowColor: 'bg-orange-500/10',
    },
    {
      icon: Wallet,
      title: 'Pay Per Inference',
      desc: 'Use cUSDC credits or create an escrow. No subscriptions, no hidden fees.',
      accentColor: 'bg-orange-500/50',
      glowColor: 'bg-orange-500/10',
    },
    {
      icon: Database,
      title: 'IPFS Storage',
      desc: 'Encrypted prompts stored on IPFS via Pinata. Decentralized, immutable, always available.',
      accentColor: 'bg-orange-500/50',
      glowColor: 'bg-orange-500/10',
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
          <SectionLabel>BUILT FOR PRIVACY</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-bold font-heading text-brand-text mt-4 mb-4">
            Built for <span className="gradient-text">Privacy</span>
          </h2>
          <p className="text-brand-text-secondary max-w-xl mx-auto">
            Every layer of the stack is designed to keep your data confidential
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              desc={feature.desc}
              accentColor={feature.accentColor}
              glowColor={feature.glowColor}
            />
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
        <SectionLabel>BUILT ON</SectionLabel>

        <motion.div
          variants={staggerSlow}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 mt-8"
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
      <GrainOverlay />

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

        <GlowDivider />

        <AnimatedBanner />
        <PrivacyMarquee />

        <GlowDivider />

        <HowItWorks />

        <GlowDivider />

        <FeaturesSection />

        <GlowDivider />

        <ArchitectureDiagram />
        <ModelShowcase />

        <GlowDivider />

        <PrivacyComparison />
        <RolesSection />

        <GlowDivider />

        <PartnersSection />
        <FinalCTA />
      </main>

      <Footer />
    </div>
  )
}
