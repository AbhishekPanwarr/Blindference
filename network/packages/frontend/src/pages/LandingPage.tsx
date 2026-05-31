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
import PromoCard from '../components/landing/PromoCard'
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
          'linear-gradient(to bottom, transparent 50%, rgba(139, 92, 246, 0.03) 51%, transparent 100%)',
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
        className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full bg-violet-500/5 blur-[120px]"
      />
      <motion.div
        animate={{
          x: [0, -80, 40, 0],
          y: [0, 40, -60, 0],
          scale: [1, 0.85, 1.1, 1],
        }}
        transition={{ duration: 25, ease: 'linear', repeat: Infinity }}
        className="absolute top-[40%] right-[10%] w-[400px] h-[400px] rounded-full bg-indigo-500/3 blur-[100px]"
      />
    </div>
  )
}

/* ─── Hero ─── */
function HeroSection() {
  return (
    <section className="relative flex min-h-[80vh] items-start md:items-center overflow-hidden">
      {/* Background: Animated grid */}
      <HeroGrid />

      {/* Globe — positioned to the right, NullPay-style */}
      <motion.div
        variants={fadeInScale}
        initial="hidden"
        animate="show"
        className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      >
        <div className="absolute right-[-12rem] top-1/2 -translate-y-1/2 opacity-80 sm:right-[-8rem] md:right-[-6%] lg:right-[-2%] xl:right-[2%]">
          <DottedGlobe className="w-[26rem] max-w-none sm:w-[30rem] md:w-[34rem] lg:w-[38rem] xl:w-[42rem]" />
        </div>
      </motion.div>

      {/* Hero content */}
      <div className="relative z-10 w-full px-6 md:px-12 lg:px-24 pt-6 md:pt-36 pb-12">
        <motion.div
          variants={staggerSlow}
          initial="hidden"
          animate="show"
          className="mx-auto flex max-w-4xl flex-col items-center gap-10 md:gap-10"
        >
          <div className="relative flex w-full justify-center overflow-visible">
            <div className="relative z-20 flex max-w-4xl flex-col items-center text-center md:items-center md:text-center">
              {/* Main headline */}
              <motion.div variants={fadeInUp} className="relative z-20">
                <h1 className="text-[3.3rem] font-black leading-[0.9] tracking-[-0.06em] sm:text-[3.9rem] md:text-7xl lg:text-[5rem] xl:text-[5.8rem]">
                  <span className="block text-white">Confidential AI</span>
                  <span className="block mt-1 md:mt-0">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-violet-500 via-purple-500 to-cyan-400 drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]">Inference,</span>{' '}
                    <span className="text-white/60">Verified.</span>
                  </span>
                </h1>
              </motion.div>

              <motion.p
                variants={fadeInUp}
                className="max-w-2xl pt-6 text-xl font-light leading-relaxed tracking-wide text-white/60 md:text-2xl lg:text-[1.35rem]"
              >
                Your prompts are encrypted with{' '}
                <span className="text-white/90 font-medium border-b border-violet-500/30">
                  FHE
                </span>
                . Your answers are proven by{' '}
                <span className="text-white/90 font-medium border-b border-violet-500/30">
                  quorum consensus
                </span>{' '}
                inside TEEs.
              </motion.p>

              {/* CTAs */}
              <motion.div
                variants={fadeInUp}
                className="flex flex-col items-center justify-center gap-4 pt-6"
              >
                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Link
                    to="/app"
                    className="group inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full bg-violet-500 px-6 py-3 text-base font-semibold text-white shadow-[0_4px_20px_rgba(139,92,246,0.3)] transition-all hover:scale-[1.03] hover:bg-violet-400 hover:shadow-[0_8px_30px_rgba(139,92,246,0.5)]"
                  >
                    <span className="relative z-10">Launch App</span>
                    <ArrowRight className="relative z-10 w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>

                  <Link
                    to="/docs"
                    className="group inline-flex min-w-[180px] items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-6 py-3 text-base font-semibold text-white/70 transition-all hover:border-white/[0.2] hover:bg-white/[0.06] hover:text-white"
                  >
                    <span className="relative z-10">Documentation</span>
                    <ArrowRight className="relative z-10 w-4 h-4 text-white/40 transition-colors group-hover:text-white" />
                  </Link>
                </div>
              </motion.div>

              {/* Trust badges */}
              <motion.div
                variants={fadeInUp}
                className="mt-8 flex flex-wrap justify-center gap-3"
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
                    className="group relative flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-violet-500/20 transition-all duration-500 backdrop-blur-xl cursor-default"
                  >
                    <span className="text-[10px] font-mono tracking-[0.25em] text-white/50 group-hover:text-white/80 transition-colors uppercase font-bold">
                      {label}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
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
      accentColor: 'bg-violet-500/50',
      glowColor: 'bg-violet-500/10',
    },
    {
      icon: CheckCircle2,
      title: 'Quorum Consensus',
      desc: '1 leader + 2 verifiers run the same inference. Mismatches trigger automatic dispute resolution.',
      accentColor: 'bg-violet-500/50',
      glowColor: 'bg-violet-500/10',
    },
    {
      icon: Shield,
      title: 'On-Chain Insurance',
      desc: 'Optional hallucination coverage via Reineira. Disputed results trigger USDC payouts.',
      accentColor: 'bg-violet-500/50',
      glowColor: 'bg-violet-500/10',
    },
    {
      icon: Server,
      title: 'Decentralized Nodes',
      desc: 'Anyone can run a compute node. Attestation, staking, and slashing keep the network honest.',
      accentColor: 'bg-violet-500/50',
      glowColor: 'bg-violet-500/10',
    },
    {
      icon: Wallet,
      title: 'Pay Per Inference',
      desc: 'Use cUSDC credits or create an escrow. No subscriptions, no hidden fees.',
      accentColor: 'bg-violet-500/50',
      glowColor: 'bg-violet-500/10',
    },
    {
      icon: Database,
      title: 'IPFS Storage',
      desc: 'Encrypted prompts stored on IPFS via Pinata. Decentralized, immutable, always available.',
      accentColor: 'bg-violet-500/50',
      glowColor: 'bg-violet-500/10',
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
            Built for <span className="text-gradient-purple">Privacy</span>
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
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-300">
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
    <footer className="relative border-t border-violet-500/10 px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-violet-500 text-white font-extrabold text-sm flex items-center justify-center glow-violet">
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
                to="/nodes"
                className="block text-sm text-brand-text-secondary hover:text-brand-text transition-colors"
              >
                Run a Node
              </Link>
              <Link
                to="/nodes"
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

        <div className="pt-8 border-t border-violet-500/10 flex flex-col sm:flex-row items-center justify-between gap-4">
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

      <main className="relative z-10">
        <HeroSection />

        <GlowDivider />

        <AnimatedBanner />
        <PrivacyMarquee />

        <GlowDivider />

        <HowItWorks />

        <GlowDivider />

        <FeaturesSection />

        <PromoCard />

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
