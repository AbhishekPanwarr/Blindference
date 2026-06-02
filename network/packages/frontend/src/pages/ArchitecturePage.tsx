import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Shield,
  Lock,
  Server,
  Cpu,
  Wallet,
  Globe,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCode,
  Activity,
  Clock,
  Zap,
  ChevronRight,
  Scale,
} from 'lucide-react'
import { fadeInUp, fadeInScale, staggerSlow } from '../lib/animations'
import { GlassCard } from '../components/ui/GlassCard'
import { SectionLabel, GlowDivider } from '../components/effects/GlowDivider'
import { GrainOverlay } from '../components/effects/GrainOverlay'

/* ─── Flow Step ─── */
function FlowStep({
  number,
  title,
  description,
  icon: Icon,
  delay,
}: {
  number: number
  title: string
  description: string
  icon: React.ElementType
  delay: number
}) {
  return (
    <motion.div
      variants={fadeInScale}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-30px' }}
      transition={{ delay }}
      className="relative"
    >
      <GlassCard className="gradient-accent-top p-6 relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <span className="text-sm font-bold text-violet-400">{number}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-white/50" />
              <h4 className="text-sm font-bold text-white">{title}</h4>
            </div>
            <p className="text-white/50 text-xs leading-relaxed">{description}</p>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}

/* ─── Threat Card ─── */
function ThreatCard({
  title,
  description,
  mitigation,
  icon: Icon,
  delay,
}: {
  title: string
  description: string
  mitigation: string
  icon: React.ElementType
  delay: number
}) {
  return (
    <motion.div
      variants={fadeInScale}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      transition={{ delay }}
    >
      <GlassCard className="gradient-accent-top p-6 h-full border-red-500/10 hover:border-red-500/20 transition-all duration-500">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-red-400" />
          </div>
          <h4 className="text-sm font-bold text-white">{title}</h4>
        </div>
        <p className="text-white/50 text-xs leading-relaxed mb-4">{description}</p>
        <div className="flex items-start gap-2 pt-3 border-t border-white/10">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
          <p className="text-green-400/80 text-xs">{mitigation}</p>
        </div>
      </GlassCard>
    </motion.div>
  )
}

/* ─── Main Page ─── */
export default function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <GrainOverlay />

      {/* Background aurora */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <motion.div
          animate={{ x: [0, 100, -60, 0], y: [0, -60, 80, 0], scale: [1, 1.15, 0.9, 1] }}
          transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
          className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-[120px]"
        />
        <motion.div
          animate={{ x: [0, -80, 40, 0], y: [0, 40, -60, 0], scale: [1, 0.85, 1.1, 1] }}
          transition={{ duration: 25, ease: 'linear', repeat: Infinity }}
          className="absolute top-[40%] right-[10%] w-[400px] h-[400px] rounded-full bg-violet-500/5 blur-[100px]"
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
                <SectionLabel>TECHNICAL DEEP DIVE</SectionLabel>
              </motion.div>

              <motion.h1
                variants={fadeInUp}
                className="text-4xl md:text-5xl lg:text-6xl font-bold mt-6 mb-6 tracking-tight"
              >
                Architecture by{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-violet-500 to-indigo-400">
                  Design
                </span>
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto leading-relaxed"
              >
                Blindference leverages Fully Homomorphic Encryption (FHE),
                quorum consensus, and on-chain economic accountability to ensure
                your AI inference remains confidential, verifiable, and
                tamper-proof.
              </motion.p>
            </motion.div>
          </div>
        </section>

        <GlowDivider />

        {/* Before / After */}
        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <SectionLabel>THE ENCRYPTION STACK</SectionLabel>
              <h2 className="text-3xl md:text-4xl font-bold mt-4 text-white">
                From <span className="text-red-400">Plaintext</span> to{' '}
                <span className="gradient-text">Confidential</span>
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Before */}
              <motion.div
                variants={fadeInScale}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
              >
                <GlassCard className="gradient-accent-top p-8 border-red-500/10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                      <XCircle className="w-4 h-4 text-red-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Before: Plaintext API</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm text-white/60">
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-mono">1</div>
                      <span>User sends prompt to centralized API</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-white/60">
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-mono">2</div>
                      <span>Provider sees full plaintext</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-white/60">
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-mono">3</div>
                      <span>Result stored in provider logs</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-white/60">
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-mono">4</div>
                      <span>No verifiability of execution</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/10 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-red-400/80">
                      <XCircle className="w-3 h-3" />
                      <span>API provider sees plaintext</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-red-400/80">
                      <XCircle className="w-3 h-3" />
                      <span>Result stored in provider logs</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-red-400/80">
                      <XCircle className="w-3 h-3" />
                      <span>No verifiability of execution</span>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>

              {/* After */}
              <motion.div
                variants={fadeInScale}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                transition={{ delay: 0.15 }}
              >
                <GlassCard className="gradient-accent-top p-8 border-green-500/10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">After: Blindference</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm text-white/60">
                      <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-xs font-mono text-violet-400">1</div>
                      <span>Browser encrypts prompt with AES-256</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-white/60">
                      <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-xs font-mono text-violet-400">2</div>
                      <span>Encrypted blob stored on IPFS</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-white/60">
                      <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-xs font-mono text-violet-400">3</div>
                      <span>CoFHE ACL controls who can decrypt</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-white/60">
                      <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-xs font-mono text-violet-400">4</div>
                      <span>2/3 quorum consensus required</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/10 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-green-400/80">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>User never sends plaintext to any node</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-green-400/80">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>CoFHE threshold network enforces ACL</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-green-400/80">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Result hash committed on-chain</span>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            </div>
          </div>
        </section>

        <GlowDivider />

        {/* Components */}
        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <SectionLabel>SYSTEM COMPONENTS</SectionLabel>
              <h2 className="text-3xl md:text-4xl font-bold mt-4 text-white">
                The <span className="gradient-text">Stack</span>
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ICL */}
              <motion.div variants={fadeInScale} initial="hidden" whileInView="show" viewport={{ once: true }}>
                <GlassCard className="gradient-accent-top p-8 h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                      <Server className="w-5 h-5 text-violet-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Inference Coordination Layer</h3>
                  </div>
                  <p className="text-white/50 text-sm leading-relaxed mb-4">
                    FastAPI coordinator that does NOT perform inference or hold decryption keys. It validates requests, selects quorums, dispatches tasks, aggregates results, and commits accepted outcomes on-chain.
                  </p>
                  <div className="space-y-1.5">
                    {['Request validation', 'Quorum selection', 'Task dispatch', 'Result aggregation', 'On-chain commitment'].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-xs text-white/40">
                        <ChevronRight className="w-3 h-3 text-violet-400/60" />
                        {item}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </motion.div>

              {/* Nodes */}
              <motion.div variants={fadeInScale} initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ delay: 0.1 }}>
                <GlassCard className="gradient-accent-top p-8 h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                      <Cpu className="w-5 h-5 text-violet-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Compute Nodes</h3>
                  </div>
                  <p className="text-white/50 text-sm leading-relaxed mb-4">
                    Event-driven runtime. Nodes register callback URLs, receive tasks via HTTP push, decrypt inputs via CoFHE bridge, run inference (Groq, Gemini, or local vLLM), and submit results back.
                  </p>
                  <div className="space-y-1.5">
                    {['Attestation & heartbeat', 'CoFHE decryption bridge', 'Groq / Gemini / vLLM backends', 'On-chain commitment (contract mode)'].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-xs text-white/40">
                        <ChevronRight className="w-3 h-3 text-violet-400/60" />
                        {item}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </motion.div>

              {/* Smart Contracts */}
              <motion.div variants={fadeInScale} initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ delay: 0.2 }}>
                <GlassCard className="gradient-accent-top p-8 h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                      <FileCode className="w-5 h-5 text-violet-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Smart Contracts</h3>
                  </div>
                  <p className="text-white/50 text-sm leading-relaxed mb-4">
                    Deployed on Arbitrum Sepolia. Core protocol contracts for node registry, key storage, result commitments, staking, insurance, and on-chain inference consensus.
                  </p>
                  <div className="space-y-1.5">
                    {['NodeRegistry — operator registration', 'PromptKeyStore — encrypted key halves', 'ResultRegistry — accepted outcomes', 'BlindferenceStaking — BLIND token economics', 'BlindferenceInference — on-chain quorum'].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-xs text-white/40">
                        <ChevronRight className="w-3 h-3 text-violet-400/60" />
                        {item}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </motion.div>

              {/* Frontend */}
              <motion.div variants={fadeInScale} initial="hidden" whileInView="show" viewport={{ once: true }} transition={{ delay: 0.3 }}>
                <GlassCard className="gradient-accent-top p-8 h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-violet-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Frontend</h3>
                  </div>
                  <p className="text-white/50 text-sm leading-relaxed mb-4">
                    React application running entirely in the browser. CoFHE encryption happens client-side before any data leaves the device. The only component that ever sees plaintext.
                  </p>
                  <div className="space-y-1.5">
                    {['Browser-side CoFHE encryption', 'Wallet via wagmi/viem', 'IPFS upload for encrypted blobs', 'Sharing permit creation per node', 'Output decryption and display'].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-xs text-white/40">
                        <ChevronRight className="w-3 h-3 text-violet-400/60" />
                        {item}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </motion.div>
            </div>
          </div>
        </section>

        <GlowDivider />

        {/* Execution Flow */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <SectionLabel>EXECUTION FLOW</SectionLabel>
              <h2 className="text-3xl md:text-4xl font-bold mt-4 text-white">
                Text Inference <span className="gradient-text">Pipeline</span>
              </h2>
            </motion.div>

            <div className="space-y-4">
              <FlowStep
                number={1}
                title="Browser Encryption"
                description="User's prompt is encrypted with AES-256-GCM in the browser. The encryption key is ephemeral and never leaves the device."
                icon={Lock}
                delay={0}
              />
              <FlowStep
                number={2}
                title="IPFS Upload"
                description="Encrypted blob is uploaded to IPFS via Pinata. The IPFS CID is recorded for later retrieval by quorum nodes."
                icon={Server}
                delay={0.1}
              />
              <FlowStep
                number={3}
                title="Key Split & CoFHE"
                description="AES key is split into two uint128 halves. Each half is CoFHE-encrypted and stored in PromptKeyStore with ACL: only assigned nodes can decrypt."
                icon={Shield}
                delay={0.2}
              />
              <FlowStep
                number={4}
                title="ICL Dispatch"
                description="Job submitted to ICL. ICL validates request, selects 1 leader + 2 verifiers from attested node pool, and dispatches tasks with role assignments and permits."
                icon={Activity}
                delay={0.3}
              />
              <FlowStep
                number={5}
                title="Node Execution"
                description="Nodes decrypt their assigned key half via CoFHE bridge, download blob from IPFS, reconstruct AES key, decrypt prompt, and run inference via Groq/Gemini/vLLM."
                icon={Cpu}
                delay={0.4}
              />
              <FlowStep
                number={6}
                title="Quorum Consensus"
                description="Leader submits result hash. Verifiers independently re-run inference and submit match/no-match verdicts. 2/3 match = ACCEPTED. <2/3 = REJECTED."
                icon={Scale}
                delay={0.5}
              />
              <FlowStep
                number={7}
                title="On-Chain Commitment"
                description="Accepted results are committed to ResultRegistry on Arbitrum Sepolia. Payment Service distributes rewards: 60% leader, 20% each verifier."
                icon={FileCode}
                delay={0.6}
              />
              <FlowStep
                number={8}
                title="User Decryption"
                description="Frontend polls status, sees ACCEPTED. Requests output key from PromptKeyStore (user-only ACL). Downloads encrypted output blob from IPFS. Decrypts and displays result."
                icon={Globe}
                delay={0.7}
              />
            </div>
          </div>
        </section>

        <GlowDivider />

        {/* Security Model */}
        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <SectionLabel>SECURITY MODEL</SectionLabel>
              <h2 className="text-3xl md:text-4xl font-bold mt-4 text-white">
                Threats & <span className="gradient-text">Mitigations</span>
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ThreatCard
                title="Malicious Leader"
                description="A leader could return a fake result hash. Verifiers independently run the same inference with the same inputs. If the leader's hash does not match, verifiers reject. With <2/3 consensus, the job is rejected and the leader may be slashed."
                mitigation="Verifiers act as independent auditors. A single honest verifier can detect and reject a bad result."
                icon={AlertTriangle}
                delay={0}
              />
              <ThreatCard
                title="Compromised Node"
                description="Nodes must re-attest periodically. A compromised node will fail attestation (mock TEE checks for testnet, real TPM/TEE for production) and be excluded from quorum selection."
                mitigation="Consecutive failures trigger automatic slashing. Attestation ensures only trusted hardware can participate."
                icon={XCircle}
                delay={0.1}
              />
              <ThreatCard
                title="ICL Compromise"
                description="The ICL never receives encryption keys. It only coordinates tasks. Even a fully compromised ICL cannot decrypt user data because the CoFHE threshold network enforces ACL checks independently."
                mitigation="CoFHE threshold network enforces access control independently of the ICL. Keys never touch the coordinator."
                icon={Shield}
                delay={0.2}
              />
              <ThreatCard
                title="Sybil Attack"
                description="Running many cheap nodes to control the quorum. New nodes start at the lowest tier and must complete successful jobs to improve their score."
                mitigation="1000 BLIND minimum stake. Reputation system rewards consistent honest nodes. Economic cost of Sybil attacks exceeds potential gains."
                icon={Globe}
                delay={0.3}
              />
            </div>
          </div>
        </section>

        <GlowDivider />

        {/* Economic Model */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <SectionLabel>ECONOMIC MODEL</SectionLabel>
              <h2 className="text-3xl md:text-4xl font-bold mt-4 text-white">
                Incentives & <span className="gradient-text">Penalties</span>
              </h2>
            </motion.div>

            <motion.div
              variants={fadeInScale}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              <GlassCard className="gradient-accent-top p-8">
                {/* Fee Structure */}
                <div className="mb-8">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-violet-400" />
                    Fee Structure
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="text-xs text-white/40 mb-1">Model Fee</div>
                      <div className="text-lg font-bold text-white">Variable</div>
                      <div className="text-xs text-white/30 mt-1">Groq/Gemini cost + compute overhead</div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="text-xs text-white/40 mb-1">Coverage Premium</div>
                      <div className="text-lg font-bold text-white">+2%</div>
                      <div className="text-xs text-white/30 mt-1">Optional hallucination insurance</div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="text-xs text-white/40 mb-1">Quorum Tier</div>
                      <div className="text-lg font-bold text-white">+0-20%</div>
                      <div className="text-xs text-white/30 mt-1">TEE-attested nodes command premium</div>
                    </div>
                  </div>
                </div>

                {/* Reward Distribution */}
                <div className="mb-8 pt-6 border-t border-white/10">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-violet-400" />
                    Reward Distribution (per accepted job)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/10">
                      <div className="text-xs text-violet-400/60 mb-1">Leader</div>
                      <div className="text-2xl font-bold text-violet-400">60%</div>
                      <div className="text-xs text-white/30 mt-1">Primary compute + output key storage</div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="text-xs text-white/40 mb-1">Verifier 1</div>
                      <div className="text-2xl font-bold text-white">20%</div>
                      <div className="text-xs text-white/30 mt-1">Cross-validation</div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="text-xs text-white/40 mb-1">Verifier 2</div>
                      <div className="text-2xl font-bold text-white">20%</div>
                      <div className="text-xs text-white/30 mt-1">Cross-validation</div>
                    </div>
                  </div>
                </div>

                {/* Staking */}
                <div className="pt-6 border-t border-white/10">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-red-400" />
                    Staking & Slashing
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <span className="text-sm text-white/70">Minimum Stake</span>
                      <span className="text-sm font-bold text-white">1,000 BLIND</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <span className="text-sm text-white/70">Unbond Period</span>
                      <span className="text-sm font-bold text-white">96 hours</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                      <span className="text-sm text-red-400/70">Slash: 3 Consecutive Failures</span>
                      <span className="text-sm font-bold text-red-400">10% Burned</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                      <span className="text-sm text-red-400/70">Slash: Verdict Manipulation</span>
                      <span className="text-sm font-bold text-red-400">25% Burned</span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
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
              Want to go deeper?
            </h2>
            <p className="text-white/40 mb-8">
              Read the full technical whitepaper for formal notation, contract addresses, and API reference.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/whitepaper"
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-violet-500 px-8 py-3.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(139,92,246,0.3)] transition-all hover:scale-[1.03] hover:bg-violet-400 hover:shadow-[0_8px_30px_rgba(139,92,246,0.5)]"
              >
                <span className="relative z-10">Read the Whitepaper</span>
                <ArrowRight className="relative z-10 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/docs"
                className="inline-flex items-center gap-2 bg-white/[0.03] border border-white/10 text-white/80 font-semibold text-sm rounded-full px-8 py-3.5 transition-all hover:border-white/20 hover:text-white"
              >
                <FileCode className="w-4 h-4" />
                API Documentation
              </Link>
            </div>
          </motion.div>
        </section>

        <div className="h-20" />
      </div>
    </div>
  )
}
