import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Shield,
  Scale,
  Globe,
  Wallet,
  Cpu,
  Code2,
  FlaskConical,
  ArrowRight,
  Zap,
  CheckCircle2,
  Lock,
  Server,
  Terminal,
  FileText,
} from 'lucide-react'
import { fadeInUp, fadeInScale, staggerSlow, easePremium } from '../lib/animations'
import { GlassCard } from '../components/ui/GlassCard'
import { SectionLabel, GlowDivider } from '../components/effects/GlowDivider'
import { GrainOverlay } from '../components/effects/GrainOverlay'

/* ─── Vision Card ─── */
function VisionCard({
  icon: Icon,
  title,
  description,
  accent,
  delay,
}: {
  icon: React.ElementType
  title: string
  description: string
  accent: string
  delay: number
}) {
  return (
    <motion.div
      variants={fadeInScale}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-50px' }}
      transition={{ delay }}
      className="group relative"
    >
      <GlassCard className="gradient-accent-top p-8 h-full relative overflow-hidden border-white/[0.08] hover:border-white/[0.15] transition-all duration-500">
        {/* Corner glow */}
        <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full ${accent} opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-3xl`} />

        <div className="relative z-10 flex flex-col h-full">
          <div className={`w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.12] flex items-center justify-center mb-5 group-hover:scale-110 transition-all duration-500`}>
            <Icon className={`w-5 h-5 ${accent.replace('/10', '').replace('/20', '')}`} />
          </div>

          <h3 className="text-lg font-bold text-white mb-3 tracking-tight">{title}</h3>
          <p className="text-white/50 text-sm leading-relaxed flex-1">{description}</p>
        </div>
      </GlassCard>
    </motion.div>
  )
}

/* ─── Roadmap Step ─── */
function RoadmapStep({
  phase,
  title,
  description,
  status,
  delay,
}: {
  phase: string
  title: string
  description: string
  status: 'completed' | 'active' | 'upcoming'
  delay: number
}) {
  const statusColors = {
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    active: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    upcoming: 'bg-white/5 text-white/30 border-white/10',
  }

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      transition={{ delay }}
      className="relative pl-8 pb-12 last:pb-0"
    >
      {/* Timeline line */}
      <div className="absolute left-[11px] top-6 w-[2px] h-full bg-white/10" />

      {/* Dot */}
      <div className={`absolute left-0 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
        status === 'completed'
          ? 'bg-green-500/20 border-green-500/50'
          : status === 'active'
          ? 'bg-violet-500/20 border-violet-500/50'
          : 'bg-white/5 border-white/20'
      }`}>
        {status === 'completed' && <CheckCircle2 className="w-3 h-3 text-green-400" />}
        {status === 'active' && <Zap className="w-3 h-3 text-violet-400" />}
        {status === 'upcoming' && <div className="w-1.5 h-1.5 rounded-full bg-white/30" />}
      </div>

      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.2em] border mb-3 ${statusColors[status]}`}>
        {phase}
      </div>

      <h4 className="text-lg font-bold text-white mb-2">{title}</h4>
      <p className="text-white/50 text-sm leading-relaxed max-w-lg">{description}</p>
    </motion.div>
  )
}

/* ─── Main Page ─── */
export default function VisionPage() {
  const visions = [
    {
      icon: Shield,
      title: 'Privacy-First AI',
      description: 'Your prompts, medical records, financial models — never exposed to any single party. AES-256-GCM + CoFHE threshold encryption ensures only the quorum can access your inputs, and even they only see fragments.',
      accent: 'bg-violet-500/10',
    },
    {
      icon: Scale,
      title: 'Verifiable Compute',
      description: "Don't trust, verify. A quorum of 1 leader + 2 verifiers independently runs the same inference. Mismatches trigger automatic rejection. The result hash is committed on-chain for eternal auditability.",
      accent: 'bg-violet-500/10',
    },
    {
      icon: Globe,
      title: 'Open Node Network',
      description: 'Anyone with a GPU-capable machine can join as a compute node. Attestation, staking, and slashing keep the network honest. No single corporation controls the inference layer.',
      accent: 'bg-violet-500/10',
    },
    {
      icon: Wallet,
      title: 'Economic Accountability',
      description: 'Bad outputs are financially penalized. Nodes stake BLIND tokens; 3 consecutive failures trigger automatic slashing. Insurance coverage protects users from hallucination risk with USDC-backed payouts.',
      accent: 'bg-violet-500/10',
    },
    {
      icon: Cpu,
      title: 'Multi-Modal Inference',
      description: 'Text, structured financial data, images — any modality. Groq Llama 70B, Gemini 2.5 Flash, or local vLLM models. You choose the model, the network guarantees the privacy.',
      accent: 'bg-violet-500/10',
    },
    {
      icon: Code2,
      title: 'Developer SDK',
      description: "Integrate confidential inference into your application with @blindference/agent-sdk. Python SDK, REST API, and smart contract hooks — private AI as easy as Stripe.",
      accent: 'bg-violet-500/10',
    },
    {
      icon: FlaskConical,
      title: 'The Research Frontier',
      description: 'Fully homomorphic inference is the north star. As FHE accelerators mature, we will migrate from threshold-decrypt + off-chain compute to pure on-chain FHE inference. Blindference is building the bridge.',
      accent: 'bg-violet-500/10',
    },
  ]

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <GrainOverlay />

      {/* Background aurora */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <motion.div
          animate={{ x: [0, 100, -60, 0], y: [0, -60, 80, 0], scale: [1, 1.15, 0.9, 1] }}
          transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
          className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full bg-violet-500/5 blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -80, 40, 0], y: [0, 40, -60, 0], scale: [1, 0.85, 1.1, 1] }}
          transition={{ duration: 25, ease: 'linear', repeat: Infinity }}
          className="absolute top-[40%] right-[10%] w-[400px] h-[400px] rounded-full bg-white/3 blur-[100px]"
        />
      </div>

      <div className="relative z-10">
        {/* Hero */}
        <section className="relative pt-32 pb-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              variants={staggerSlow}
              initial="hidden"
              animate="show"
            >
              <motion.div variants={fadeInUp}>
                <SectionLabel>OUR VISION</SectionLabel>
              </motion.div>

              <motion.h1
                variants={fadeInUp}
                className="text-4xl md:text-5xl lg:text-6xl font-bold mt-6 mb-6 tracking-tight"
              >
                The Future of{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-violet-500 to-indigo-400">
                  Confidential AI
                </span>
                <br />
                Inference
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto leading-relaxed"
              >
                Blindference isn't just a tool; it's a vision for a world where
                AI inference on sensitive data is private by default, provably
                verifiable, and economically accountable.
              </motion.p>

              <motion.div variants={fadeInUp} className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Link
                  to="/architecture"
                  className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-white/[0.03] border border-white/10 px-8 py-3.5 text-sm font-semibold text-white/80 backdrop-blur-sm transition-all hover:border-violet-500/30 hover:text-white"
                >
                  <span className="relative z-10">Explore Architecture</span>
                  <ArrowRight className="relative z-10 w-4 h-4 text-white/50 transition-all group-hover:text-white group-hover:translate-x-1" />
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                </Link>
                <Link
                  to="/whitepaper"
                  className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Read the Whitepaper
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <GlowDivider />

        {/* Vision Cards */}
        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <SectionLabel>CORE PRINCIPLES</SectionLabel>
              <h2 className="text-3xl md:text-4xl font-bold mt-4 text-white">
                Built for <span className="gradient-text">Privacy</span>
              </h2>
              <p className="text-white/40 mt-4 max-w-xl mx-auto">
                Every layer of the stack is designed to keep your data confidential
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {visions.map((v, i) => (
                <VisionCard
                  key={v.title}
                  icon={v.icon}
                  title={v.title}
                  description={v.description}
                  accent={v.accent}
                  delay={i * 0.1}
                />
              ))}
            </div>
          </div>
        </section>

        <GlowDivider />

        {/* Roadmap */}
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <SectionLabel>ROADMAP</SectionLabel>
              <h2 className="text-3xl md:text-4xl font-bold mt-4 text-white">
                Journey to <span className="gradient-text">Mainnet</span>
              </h2>
            </motion.div>

            <div className="relative">
              <RoadmapStep
                phase="Completed"
                title="Testnet Launch"
                description="Deployed core contracts on Arbitrum Sepolia. Integrated Fhenix CoFHE for browser-side encryption. Built ICL coordinator, node runtime, and frontend. Verified end-to-end text inference and risk scoring flows."
                status="completed"
                delay={0}
              />
              <RoadmapStep
                phase="In Progress"
                title="Node Network Expansion"
                description="Onboarding compute providers with GPU-capable machines. Implementing TEE-based attestation for production nodes. Refining economic model with real stake and reward distribution."
                status="active"
                delay={0.15}
              />
              <RoadmapStep
                phase="Q3 2025"
                title="Audit & Insurance"
                description="Third-party security audit of smart contracts. Launching parametric insurance product with on-chain dispute resolution. Integrating additional model providers (Claude, local fine-tuned models)."
                status="upcoming"
                delay={0.3}
              />
              <RoadmapStep
                phase="Q4 2025"
                title="Mainnet Deployment"
                description="Migrating from Sepolia testnet to Arbitrum mainnet. Enabling real BLIND token economics with slashing and rewards. Opening node registration to public operators with minimum stake requirements."
                status="upcoming"
                delay={0.45}
              />
              <RoadmapStep
                phase="2026+"
                title="Pure FHE Inference"
                description="As hardware FHE accelerators mature, migrating from threshold-decrypt + off-chain compute to fully homomorphic on-chain inference. The holy grail: encrypted inputs, encrypted computation, encrypted outputs — verifiable by math alone."
                status="upcoming"
                delay={0.6}
              />
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="py-20 px-6">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to build the future?
            </h2>
            <p className="text-white/40 mb-8">
              Join the node network, integrate the SDK, or start inferring privately today.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/app"
                className="inline-flex items-center gap-2 bg-violet-500 text-white font-bold text-sm rounded-full px-8 py-3.5 transition-all hover:scale-[1.03] hover:bg-violet-400 hover:shadow-[0_8px_30px_rgba(139,92,246,0.5)]"
              >
                Launch App
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/nodes"
                className="inline-flex items-center gap-2 bg-white/[0.03] border border-white/10 text-white/80 font-semibold text-sm rounded-full px-8 py-3.5 transition-all hover:border-white/20 hover:text-white"
              >
                <Server className="w-4 h-4" />
                Run a Node
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Footer spacing */}
        <div className="h-20" />
      </div>
    </div>
  )
}
