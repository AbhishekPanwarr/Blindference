import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  FileText,
  Shield,
  Server,
  Cpu,
  Globe,
  Wallet,
  Lock,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { fadeInUp, fadeInScale, staggerSlow } from '../lib/animations'
import { GlassCard } from '../components/ui/GlassCard'
import { SectionLabel, GlowDivider } from '../components/effects/GlowDivider'
import { GrainOverlay } from '../components/effects/GrainOverlay'

/* ─── Table of Contents Link ─── */
function TOCLink({ href, children, indent = false }: { href: string; children: React.ReactNode; indent?: boolean }) {
  return (
    <a
      href={href}
      className={`block text-sm text-white/50 hover:text-white/80 transition-colors ${indent ? 'pl-4' : ''}`}
    >
      {children}
    </a>
  )
}

/* ─── Section Heading ─── */
function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl md:text-3xl font-bold text-white mt-16 mb-6 scroll-mt-28">
      {children}
    </h2>
  )
}

/* ─── Sub Heading ─── */
function SubHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-lg font-bold text-white/90 mt-10 mb-4 scroll-mt-28">
      {children}
    </h3>
  )
}

/* ─── Paragraph ─── */
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-white/60 text-sm leading-relaxed mb-4">{children}</p>
}

/* ─── Inline Code ─── */
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-xs font-mono text-violet-300">
      {children}
    </code>
  )
}

/* ─── Code Block ─── */
function CodeBlock({ children, language = '' }: { children: string; language?: string }) {
  return (
    <div className="my-6 rounded-xl border border-white/[0.08] bg-[rgba(5,5,5,0.8)] overflow-hidden">
      {language && (
        <div className="px-4 py-2 border-b border-white/[0.06] bg-white/[0.02]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">{language}</span>
        </div>
      )}
      <pre className="p-4 text-xs font-mono text-white/70 overflow-x-auto leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  )
}

/* ─── Main Page ─── */
export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <GrainOverlay />

      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-[5%] left-[10%] w-[600px] h-[600px] rounded-full bg-violet-500/[0.03] blur-[150px]" />
        <div className="absolute top-[40%] right-[5%] w-[400px] h-[400px] rounded-full bg-blue-500/[0.03] blur-[120px]" />
      </div>

      <div className="relative z-10">
        {/* Hero */}
        <section className="relative pt-32 pb-16 px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              variants={staggerSlow}
              initial="hidden"
              animate="show"
            >
              <motion.div variants={fadeInUp}>
                <SectionLabel>WHITEPAPER</SectionLabel>
              </motion.div>

              <motion.h1
                variants={fadeInUp}
                className="text-4xl md:text-5xl lg:text-6xl font-bold mt-6 mb-6 tracking-tight"
              >
                Blindference:{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-violet-500 to-indigo-400">
                  Confidential AI Inference
                </span>
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                className="text-lg text-white/40 max-w-2xl leading-relaxed"
              >
                A technical specification for decentralized, privacy-preserving AI inference
                using Fully Homomorphic Encryption, quorum consensus, and on-chain economic accountability.
              </motion.p>

              <motion.div variants={fadeInUp} className="mt-8 flex flex-wrap items-center gap-4">
                <span className="text-xs text-white/30 font-mono">Version 1.1</span>
                <span className="text-xs text-white/20">|</span>
                <span className="text-xs text-white/30 font-mono">June 2026</span>
                <span className="text-xs text-white/20">|</span>
                <Link to="/architecture" className="text-xs text-violet-400/60 hover:text-violet-400 transition-colors flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  Visual Architecture
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <GlowDivider />

        {/* Content */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            {/* Table of Contents */}
            <motion.div
              variants={fadeInScale}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="mb-16"
            >
              <GlassCard className="gradient-accent-top p-8">
                <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-violet-400" />
                  Table of Contents
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                  <TOCLink href="#abstract">Abstract</TOCLink>
                  <TOCLink href="#system-overview">1. System Overview</TOCLink>
                  <TOCLink href="#components" indent>1.1 Components</TOCLink>
                  <TOCLink href="#frontend" indent>1.1.1 Frontend</TOCLink>
                  <TOCLink href="#icl" indent>1.1.2 ICL</TOCLink>
                  <TOCLink href="#compute-nodes" indent>1.1.3 Compute Nodes</TOCLink>
                  <TOCLink href="#smart-contracts" indent>1.1.4 Smart Contracts</TOCLink>
                  <TOCLink href="#execution-flows">2. Execution Flows</TOCLink>
                  <TOCLink href="#text-inference" indent>2.1 Text Inference</TOCLink>
                  <TOCLink href="#risk-scoring" indent>2.2 Risk Scoring</TOCLink>
                  <TOCLink href="#on-chain-mode" indent>2.3 On-Chain Mode</TOCLink>
                  <TOCLink href="#privacy-model">3. Privacy Model</TOCLink>
                  <TOCLink href="#quorum-consensus">4. Quorum Consensus</TOCLink>
                  <TOCLink href="#security-model">5. Security Model</TOCLink>
                  <TOCLink href="#economic-model">6. Economic Model</TOCLink>
                  <TOCLink href="#deployment">7. Deployment</TOCLink>
                </div>
              </GlassCard>
            </motion.div>

            {/* Abstract */}
            <SectionHeading id="abstract">Abstract</SectionHeading>
            <P>
              Blindference is a decentralized network for private AI inference. It sits between users who want to run
              models on sensitive data and compute providers who want to earn rewards for running them. The system
              guarantees three properties:
            </P>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
              <GlassCard className="gradient-accent-top p-6">
                <Lock className="w-5 h-5 text-violet-400 mb-3" />
                <h4 className="text-sm font-bold text-white mb-2">Input Privacy</h4>
                <p className="text-xs text-white/50">The user's prompt or data is encrypted before it leaves their device.</p>
              </GlassCard>
              <GlassCard className="gradient-accent-top p-6">
                <Shield className="w-5 h-5 text-blue-400 mb-3" />
                <h4 className="text-sm font-bold text-white mb-2">Execution Integrity</h4>
                <p className="text-xs text-white/50">A quorum of independent nodes runs the same inference and cross-validates the result.</p>
              </GlassCard>
              <GlassCard className="gradient-accent-top p-6">
                <Wallet className="w-5 h-5 text-green-400 mb-3" />
                <h4 className="text-sm font-bold text-white mb-2">Economic Accountability</h4>
                <p className="text-xs text-white/50">Payment is held in escrow until the quorum agrees, and bad behaviour is financially penalised.</p>
              </GlassCard>
            </div>
            <P>
              The network runs on <strong className="text-white/80">Arbitrum Sepolia</strong> for on-chain settlement and uses{' '}
              <strong className="text-white/80">Fhenix CoFHE</strong> for confidential access control. Off-chain inference
              is performed through hosted APIs (Groq, Google Gemini) or local models (vLLM).
            </P>

            {/* System Overview */}
            <SectionHeading id="system-overview">1. System Overview</SectionHeading>
            <P>
              Blindference is composed of four primary components: a browser-based frontend, an Inference Coordination Layer (ICL),
              a network of compute nodes, and a suite of smart contracts deployed on Arbitrum Sepolia.
            </P>

            <SubHeading id="components">1.1 Components</SubHeading>

            <SubHeading id="frontend">1.1.1 Frontend</SubHeading>
            <P>
              The frontend is a React application that runs entirely in the user's browser. It is the only component
              that ever sees plaintext prompts or answers.
            </P>
            <div className="space-y-2 my-4">
              {[
                'Wallet connection via MetaMask on Arbitrum Sepolia',
                'AES-256-GCM encryption for text prompts; CoFHE encryption for structured risk features',
                'Quorum preview before payment — users see which nodes will process their request',
                'Key storage via PromptKeyStore contract with CoFHE ACL enforcement',
                'IPFS upload for encrypted prompt blobs via Pinata',
                'Status polling and output decryption with ephemeral keys',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-white/60">
                  <ChevronRight className="w-4 h-4 text-violet-400/60 shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>

            <SubHeading id="icl">1.1.2 Inference Coordination Layer (ICL)</SubHeading>
            <P>
              The ICL is a FastAPI service that coordinates the lifecycle of an inference job. It does not perform
              inference itself and cannot decrypt any data.
            </P>
            <div className="space-y-2 my-4">
              {[
                'Request validation — checks encrypted inputs, model ID, and coverage preferences',
                'Quorum selection — picks 1 leader and 2 verifiers from the active, attested node pool',
                'Task dispatch — pushes tasks to node callback servers with role assignments and permits',
                'Result aggregation — collects leader results and verifier verdicts',
                'Consensus enforcement — 2/3 hash match = accepted; <2/3 = rejected',
                'On-chain commitment — writes accepted results to ResultRegistry',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-white/60">
                  <ChevronRight className="w-4 h-4 text-violet-400/60 shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>

            <SubHeading id="compute-nodes">1.1.3 Compute Nodes</SubHeading>
            <P>
              Compute nodes are the workers that perform inference. Anyone with a GPU-capable machine and a wallet
              can run one. Nodes are event-driven: they register a callback URL with the ICL and receive tasks via HTTP push.
            </P>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">
              <GlassCard className="gradient-accent-top p-4">
                <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                  <Server className="w-3.5 h-3.5 text-emerald-400" />
                  Supported Backends
                </h4>
                <div className="space-y-1">
                  <div className="text-xs text-white/50">Groq — llama-3.3-70b-versatile</div>
                  <div className="text-xs text-white/50">Google Gemini — gemini-2.5-flash</div>
                  <div className="text-xs text-white/50">Local vLLM — self-hosted models</div>
                </div>
              </GlassCard>
              <GlassCard className="gradient-accent-top p-4">
                <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  Node Lifecycle
                </h4>
                <div className="space-y-1">
                  <div className="text-xs text-white/50">1. Attestation on startup</div>
                  <div className="text-xs text-white/50">2. Heartbeat every 60s</div>
                  <div className="text-xs text-white/50">3. Task execution via push</div>
                  <div className="text-xs text-white/50">4. Result submission</div>
                </div>
              </GlassCard>
            </div>

            <SubHeading id="smart-contracts">1.1.4 Smart Contracts</SubHeading>
            <P>
              All contracts are deployed on <strong className="text-white/80">Arbitrum Sepolia</strong>. The core protocol
              consists of registries, key stores, staking, and settlement contracts.
            </P>

            <div className="my-6 rounded-xl border border-white/[0.08] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                    <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-white/40">Contract</th>
                    <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-white/40">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {[
                    ['NodeRegistry', 'Operator registration, attestation, tier, and heartbeat tracking'],
                    ['PromptKeyStore', 'Stores CoFHE-encrypted AES key halves. Enforces ACL: only assigned nodes can decrypt.'],
                    ['ResultRegistry', 'Records accepted inference outcomes with commitment hashes for audit.'],
                    ['BlindferenceStaking', 'BLIND token staking. Minimum 1000 BLIND. 96-hour unbond. Auto-slash at 3 consecutive failures.'],
                    ['BlindferenceInference', 'On-chain quorum consensus. Accepts jobs, emits NodesAssigned, enforces commit/reveal deadlines.'],
                    ['BlindferenceInputVault', 'On-chain FHE input validation. Grants ACL access so nodes can decrypt browser-generated ciphertexts.'],
                  ].map(([contract, purpose]) => (
                    <tr key={contract} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-violet-400/80">{contract}</td>
                      <td className="px-4 py-3 text-xs text-white/50">{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Execution Flows */}
            <SectionHeading id="execution-flows">2. Execution Flows</SectionHeading>

            <SubHeading id="text-inference">2.1 Text Inference (ICL Mode)</SubHeading>
            <P>
              This is the default flow for natural language prompts. The user's prompt is encrypted in the browser,
              stored on IPFS, and processed by a quorum of nodes.
            </P>

            <CodeBlock language="Flow">
{`1. User types a confidential prompt in the browser
2. Browser generates an AES-256 key and encrypts the prompt locally
3. Encrypted blob is uploaded to Pinata IPFS. The IPFS CID is recorded
4. AES key is split into two uint128 halves
5. Each half is CoFHE-encrypted in the browser
6. User signs a MetaMask transaction to store both halves in PromptKeyStore,
   gated to the future quorum nodes
7. User submits the job to the ICL, referencing the CID and the key store handles
8. ICL validates the request, selects 1 leader + 2 verifiers, and dispatches tasks
9. Each node receives its role, permit, and task metadata
10. Nodes call PromptKeyStore to decrypt their assigned key half via CoFHE ACL
11. Nodes download the encrypted blob from IPFS
12. Nodes combine key halves, decrypt the blob, and run inference via Groq/Gemini
13. Leader submits a result hash + an output key (for the user) to the ICL
14. Verifiers submit verdicts: match or no-match against the leader hash
15. ICL waits for all verdicts
    - If 2/3 match → status = ACCEPTED. ICL commits result to ResultRegistry
    - If <2/3 match → status = REJECTED. Payment Service refunds or triggers dispute
16. Frontend polls status, sees ACCEPTED
17. Frontend requests the output key from PromptKeyStore (user-only ACL)
18. Frontend downloads the encrypted output blob from IPFS
19. Frontend decrypts and displays the answer. Only the user ever sees it`}
            </CodeBlock>

            <SubHeading id="risk-scoring">2.2 Risk Scoring (ICL Mode)</SubHeading>
            <P>
              This flow is for structured financial data (credit scores, loan amounts, etc.). Numeric features are
              CoFHE-encrypted directly without the AES intermediate layer.
            </P>
            <CodeBlock language="Flow">
{`1. User enters structured features in the browser (credit score, loan amount, etc.)
2. Browser CoFHE-encrypts each feature directly via @cofhe/sdk as euint32, euint64, etc.
3. User creates one sharing permit per quorum node
4. User submits encrypted features + permits to the ICL
5. ICL selects quorum and dispatches
6. Nodes import their sharing permit and decrypt features via CoFHE
7. Nodes run the risk model (deterministic classification or regression)
8. Leader submits result hash; verifiers cross-validate
9. Consensus and settlement proceed exactly like text inference`}
            </CodeBlock>

            <SubHeading id="on-chain-mode">2.3 On-Chain Mode</SubHeading>
            <P>
              In on-chain mode, the ICL is bypassed for dispatch and consensus. The smart contract enforces deadlines
              and payouts directly.
            </P>
            <CodeBlock language="Flow">
{`1. User submits a job directly to the BlindferenceInference contract via MetaMask
2. Contract emits a NodesAssigned event with the task ID and assigned nodes
3. Nodes listen for the event via WebSocket or polling
4. Nodes decrypt inputs and run inference
5. Nodes post commitment hashes directly to the contract within the commit window (600s)
6. After the reveal window (600s), the contract checks for 2/3 consensus
7. If consensus is reached, the contract auto-distributes rewards from the escrow
8. User polls the contract for status and decrypts the result locally`}
            </CodeBlock>
            <P>
              On-chain mode is slower but fully decentralised. No single coordinator can censor or reorder jobs.
            </P>

            {/* Privacy Model */}
            <SectionHeading id="privacy-model">3. Privacy Model</SectionHeading>
            <P>
              Blindference uses two layers of encryption depending on the data type.
            </P>

            <SubHeading id="text-prompts">3.1 Text Prompts: AES-256 + CoFHE ACL</SubHeading>
            <P>
              CoFHE encrypts numbers, not free-form text. AES handles arbitrary-length strings efficiently. The AES key
              is split into two uint128 halves so each half can be CoFHE-encrypted and stored in the{' '}
              <Code>PromptKeyStore</Code> contract.
            </P>
            <div className="space-y-2 my-4">
              {[
                'Encrypted blob is public on IPFS (anyone can fetch it), but unreadable without the AES key',
                'Only the quorum can reconstruct the key through CoFHE ACL enforcement',
                'Leader encrypts the answer with a fresh AES key and stores it in PromptKeyStore with user-only ACL',
                'Even the leader cannot read the final output',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-white/60">
                  <Lock className="w-4 h-4 text-violet-400/60 shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>

            <SubHeading id="structured-features">3.2 Structured Features: Pure CoFHE</SubHeading>
            <P>
              Numeric features are CoFHE-encrypted directly in the browser as <Code>euint32</Code>, <Code>euint64</Code>, etc.
              The <Code>BlindferenceInputVault</Code> contract validates and stores them, granting ACL access to the user's wallet.
            </P>

            <SubHeading id="threat-icl">3.3 Threat: ICL Compromise</SubHeading>
            <P>
              The ICL never receives encryption keys. It only coordinates. Even a fully compromised ICL cannot decrypt
              user data because the CoFHE threshold network enforces ACL checks independently.
            </P>

            <SubHeading id="threat-collusion">3.4 Threat: Node Collusion</SubHeading>
            <P>
              If two nodes collude, they still cannot reconstruct the full AES key unless they also compromise the third
              node or the CoFHE threshold network. The 2/3 quorum requires agreement, so a single honest verifier can
              detect and reject a bad result.
            </P>

            {/* Quorum Consensus */}
            <SectionHeading id="quorum-consensus">4. Quorum Consensus</SectionHeading>
            <P>
              <strong className="text-white/80">Default topology:</strong> 1 leader + 2 verifiers.
            </P>

            <div className="my-6 rounded-xl border border-white/[0.08] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                    <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-white/40">Verdicts</th>
                    <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-white/40">Outcome</th>
                    <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-white/40">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-white/70">Leader + 1 verifier match</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-green-400">ACCEPTED</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50">Commit to ResultRegistry, distribute rewards</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-white/70">Leader + 0 verifiers match</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-red-400">REJECTED</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50">Refund or dispute</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-white/70">Leader disagrees with both</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold text-red-400">REJECTED</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50">Leader may be slashed, dispute opened</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <P>
              <strong className="text-white/80">Timeouts:</strong> Execution commit window: 600 seconds.
              Execution reveal window: 600 seconds. Dispute deadline: 72 hours from job creation.
            </P>

            {/* Security Model */}
            <SectionHeading id="security-model">5. Security Model</SectionHeading>

            <SubHeading id="malicious-leader">5.1 Malicious Leader</SubHeading>
            <P>
              A leader could return a fake result hash. Verifiers independently run the same inference with the same inputs.
              If the leader's hash does not match, verifiers reject. With &lt;2/3 consensus, the job is rejected and the
              leader may be slashed.
            </P>

            <SubHeading id="compromised-node">5.2 Compromised Node</SubHeading>
            <P>
              Nodes must re-attest periodically. A compromised node will fail attestation (mock TEE checks for testnet,
              real TPM/TEE for production) and be excluded from quorum selection. Consecutive failures trigger automatic slashing.
            </P>

            <SubHeading id="frontend-xss">5.3 Front-End XSS</SubHeading>
            <P>
              All encryption happens in the browser before any DOM rendering. Encryption keys are ephemeral (one per request)
              and never stored in <Code>localStorage</Code> or cookies.
            </P>

            <SubHeading id="sybil">5.4 Sybil Attack</SubHeading>
            <P>
              Running many cheap nodes is economically discouraged by the staking requirement (1000 BLIND minimum) and
              the reputation system. New nodes start at the lowest tier and must complete successful jobs to improve their score.
            </P>

            {/* Economic Model */}
            <SectionHeading id="economic-model">6. Economic Model</SectionHeading>

            <SubHeading id="fees">6.1 Fees</SubHeading>
            <P>
              Users pay per inference job. The fee depends on model (frontier models cost more than local), coverage
              (optional insurance adds a 2% premium), and quorum tier (TEE-attested nodes command a premium).
            </P>

            <SubHeading id="payment-methods">6.2 Payment Methods</SubHeading>
            <div className="space-y-2 my-4">
              {[
                ['cUSDC', 'Confidential USDC via Reineira escrow. Direct, per-job.'],
                ['BLIND tokens', 'Bulk credit packages at a 20% discount vs. cUSDC.'],
                ['Credits', 'Pre-purchased balance. Fastest, no per-job MetaMask popups.'],
              ].map(([method, desc]) => (
                <div key={method} className="flex items-start gap-3 text-sm text-white/60">
                  <ChevronRight className="w-4 h-4 text-green-400/60 shrink-0 mt-0.5" />
                  <span><strong className="text-white/80">{method}</strong> — {desc}</span>
                </div>
              ))}
            </div>

            <SubHeading id="reward-distribution">6.3 Reward Distribution</SubHeading>
            <div className="my-6 rounded-xl border border-white/[0.08] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                    <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-white/40">Recipient</th>
                    <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-white/40">Share</th>
                    <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-white/40">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-white/70 font-medium">Leader</td>
                    <td className="px-4 py-3 text-xs text-violet-400 font-bold">60%</td>
                    <td className="px-4 py-3 text-xs text-white/50">Primary compute + output key storage</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-white/70 font-medium">Verifier 1</td>
                    <td className="px-4 py-3 text-xs text-white/70 font-bold">20%</td>
                    <td className="px-4 py-3 text-xs text-white/50">Cross-validation</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs text-white/70 font-medium">Verifier 2</td>
                    <td className="px-4 py-3 text-xs text-white/70 font-bold">20%</td>
                    <td className="px-4 py-3 text-xs text-white/50">Cross-validation</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <SubHeading id="staking">6.4 Staking & Slashing</SubHeading>
            <P>
              <strong className="text-white/80">Minimum stake:</strong> 1000 BLIND tokens.
              <strong className="text-white/80"> Unbond period:</strong> 96 hours. Funds are locked after unstaking.
            </P>
            <div className="my-6 space-y-2">
              {[
                ['3 consecutive failed jobs', '10% of stake burned'],
                ['Verdict manipulation detected on-chain', '25% of stake burned'],
                ['Failure to heartbeat within grace period', 'Temporary exclusion from quorum'],
              ].map(([condition, penalty]) => (
                <div key={condition} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-xs text-white/60">{condition}</span>
                  <span className="text-xs font-bold text-red-400">{penalty}</span>
                </div>
              ))}
            </div>

            <SubHeading id="insurance">6.5 Insurance</SubHeading>
            <P>
              <strong className="text-white/80">Premium:</strong> 2% of job fee.{' '}
              <strong className="text-white/80">Coverage:</strong> Full job fee refund if quorum rejects the result.{' '}
              <strong className="text-white/80">Dispute window:</strong> 72 hours.{' '}
              <strong className="text-white/80">Claim process:</strong> User submits evidence to the PayoutClaimer contract.
              If the quorum record shows rejection, the contract auto-releases the payout.
            </P>

            {/* Deployment */}
            <SectionHeading id="deployment">7. Deployment Boundaries</SectionHeading>
            <P>
              All on-chain interactions use Arbitrum Sepolia. CoFHE threshold network calls use Fhenix testnet endpoints.
              IPFS storage uses Pinata.
            </P>

            <CodeBlock language="Architecture">
{`Frontend (Browser)
  ├── HTTPS ──> ICL (FastAPI)
  ├── MetaMask ──> Core Registries (Arbitrum Sepolia)
  └── HTTPS ──> Pinata IPFS

ICL (FastAPI)
  ├── HTTPS ──> Node Runtimes (Compute Providers)
  ├── JSON-RPC ──> Core Registries (Arbitrum Sepolia)
  └── HTTPS ──> Payment Service (FastAPI)

Node Runtime
  ├── HTTPS ──> ICL (assignments, heartbeats)
  ├── MetaMask/CoFHE ──> PromptKeyStore / InputVault
  ├── HTTPS ──> Pinata IPFS (blob download)
  └── HTTPS ──> Groq / Gemini (model APIs)`}
            </CodeBlock>

            {/* Bottom CTA */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="mt-24 text-center"
            >
              <h2 className="text-2xl font-bold text-white mb-4">
                Ready to build?
              </h2>
              <p className="text-white/40 mb-8 max-w-lg mx-auto">
                Explore the visual architecture, run a node, or integrate the SDK into your application.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  to="/architecture"
                  className="inline-flex items-center gap-2 bg-white/[0.03] border border-white/10 text-white/80 font-semibold text-sm rounded-full px-8 py-3.5 transition-all hover:border-white/20 hover:text-white"
                >
                  <Globe className="w-4 h-4" />
                  Visual Architecture
                </Link>
                <Link
                  to="/app"
                  className="inline-flex items-center gap-2 bg-violet-500 text-white font-bold text-sm rounded-full px-8 py-3.5 transition-all hover:scale-[1.03] hover:bg-violet-400 hover:shadow-[0_8px_30px_rgba(139,92,246,0.5)]"
                >
                  Launch App
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        <div className="h-20" />
      </div>
    </div>
  )
}
