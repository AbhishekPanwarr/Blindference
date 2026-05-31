import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  Lock,
  Database,
  Server,
  Cpu,
  ShieldCheck,
  Wallet,
  Landmark,
} from 'lucide-react';
import { fadeInUp, fadeInScale } from '../../lib/animations';
import { cn } from '../../utils/helpers';

const CYCLE_DURATION = 6000;
const STEP_COUNT = 8;

const nodes = [
  { id: 0, x: 30, y: 55, w: 100, h: 44, label: 'Browser', Icon: Globe },
  { id: 1, x: 170, y: 55, w: 120, h: 44, label: 'CoFHE Encrypt', Icon: Lock },
  { id: 2, x: 340, y: 55, w: 100, h: 44, label: 'IPFS Store', Icon: Database },
  { id: 3, x: 490, y: 55, w: 110, h: 44, label: 'ICL Dispatch', Icon: Server },
  { id: 4, x: 370, y: 163, w: 75, h: 44, label: 'Node 1', Icon: Cpu },
  { id: 5, x: 465, y: 175, w: 75, h: 44, label: 'Node 2', Icon: Cpu },
  { id: 6, x: 560, y: 187, w: 75, h: 44, label: 'Node 3', Icon: Cpu },
  { id: 7, x: 210, y: 175, w: 110, h: 44, label: 'Quorum Verify', Icon: ShieldCheck },
  { id: 8, x: 30, y: 175, w: 120, h: 44, label: 'Reineira Escrow', Icon: Wallet },
  { id: 9, x: 25, y: 295, w: 130, h: 44, label: 'Arbitrum Settlement', Icon: Landmark },
];

const connections = [
  { path: 'M 130 77 L 170 77', step: 1 },
  { path: 'M 290 77 L 340 77', step: 2 },
  { path: 'M 440 77 L 490 77', step: 3 },
  { path: 'M 545 99 L 407 163', step: 4 },
  { path: 'M 545 99 L 502 175', step: 4 },
  { path: 'M 545 99 L 597 187', step: 4 },
  { path: 'M 370 185 L 320 185', step: 5 },
  { path: 'M 465 197 L 320 197', step: 5 },
  { path: 'M 560 209 L 320 209', step: 5 },
  { path: 'M 210 197 L 150 197', step: 6 },
  { path: 'M 90 219 L 90 295', step: 7 },
];

const bullets = [
  {
    title: 'Off-Chain TEE Execution',
    desc: 'Inference runs inside hardware enclaves. Nodes never see plaintext prompts.',
  },
  {
    title: 'FHE-Encrypted Inputs',
    desc: 'AES-256-GCM + CoFHE key splitting. Only the quorum can reconstruct.',
  },
  {
    title: 'Quorum Consensus',
    desc: 'Leader + 2 verifiers. 2/3 hash match required for on-chain commitment.',
  },
  {
    title: 'Shielded Escrow Settlement',
    desc: 'Reineira holds payment until quorum verifies. No truth, no payout.',
  },
];

function DiagramNode({
  node,
  isActive,
}: {
  node: (typeof nodes)[number];
  isActive: boolean;
}) {
  const { x, y, w, h, label, Icon } = node;
  return (
    <foreignObject x={x} y={y} width={w} height={h}>
      <motion.div
        initial={false}
        animate={
          isActive
            ? {
                borderColor: 'rgba(139,92,246,0.6)',
                boxShadow:
                  '0 0 20px rgba(139,92,246,0.35), 0 4px 24px rgba(0,0,0,0.5), inset 0 0 10px rgba(139,92,246,0.05)',
              }
            : {
                borderColor: 'rgba(255,255,255,0.08)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              }
        }
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={cn(
          'w-full h-full rounded-xl flex items-center justify-center gap-1.5 px-2',
          'bg-brand-surface/60 backdrop-blur-xl border'
        )}
      >
        <Icon
          className={cn(
            'w-3.5 h-3.5 shrink-0',
            isActive ? 'text-violet-500' : 'text-violet-400'
          )}
        />
        <span className="text-[10px] font-bold text-white whitespace-nowrap">
          {label}
        </span>
      </motion.div>
    </foreignObject>
  );
}

function ConnectionPath({
  pathD,
  isActive,
}: {
  pathD: string;
  isActive: boolean;
}) {
  return (
    <motion.path
      d={pathD}
      stroke="#A855F7"
      strokeWidth={isActive ? 2.5 : 1.5}
      strokeDasharray="6 4"
      fill="none"
      initial={false}
      animate={
        isActive
          ? {
              opacity: 0.9,
              strokeDashoffset: [0, -10],
            }
          : { opacity: 0.15, strokeDashoffset: 0 }
      }
      transition={
        isActive
          ? {
              opacity: { duration: 0.3 },
              strokeDashoffset: {
                repeat: Infinity,
                duration: 0.8,
                ease: 'linear',
              },
            }
          : { opacity: { duration: 0.3 } }
      }
    />
  );
}

export default function ArchitectureDiagram() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % STEP_COUNT);
    }, CYCLE_DURATION / STEP_COUNT);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative py-32 px-6 overflow-hidden">
      {/* Subtle background grid */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Section Header */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-20"
        >
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-violet-500">
            Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold font-heading text-brand-text mt-3 mb-4">
            Powered by{' '}
            <span className="gradient-text">Arbitrum + Fhenix + Reineira</span>
          </h2>
          <p className="text-brand-text-secondary max-w-2xl mx-auto leading-relaxed">
            A layered stack purpose-built for confidential AI. Unlike centralized
            providers where privacy is an afterthought, we make cryptographic
            verification a native, first-class feature.
          </p>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text bullets */}
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-100px' }}
            className="flex flex-col gap-6"
          >
            {bullets.map((bullet, i) => (
              <motion.div
                key={bullet.title}
                variants={fadeInScale}
                transition={{ delay: i * 0.1 }}
                className="flex gap-4"
              >
                <div className="mt-1.5 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-brand-text mb-1 font-heading">
                    {bullet.title}
                  </h3>
                  <p className="text-sm text-brand-text-secondary leading-relaxed">
                    {bullet.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Right: Interactive diagram */}
          <motion.div
            variants={fadeInScale}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-100px' }}
            className="relative w-full max-w-[720px] mx-auto aspect-[720/400] rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm shadow-glass overflow-hidden"
          >
            {/* Decorative depth shadow */}
            <div className="absolute -inset-4 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5 blur-2xl pointer-events-none" />

            <svg
              viewBox="0 0 720 400"
              className="absolute inset-0 w-full h-full"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="arch-grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="rgba(255,255,255,0.04)"
                    strokeWidth="1"
                  />
                </pattern>
                <linearGradient
                  id="node-glow"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="rgba(168,85,247,0.15)" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>

              {/* Background grid */}
              <rect width="720" height="400" fill="url(#arch-grid)" />

              {/* Connection paths */}
              {connections.map((conn, i) => (
                <ConnectionPath
                  key={i}
                  pathD={conn.path}
                  isActive={step === conn.step}
                />
              ))}

              {/* Nodes */}
              {nodes.map((node) => (
                <DiagramNode
                  key={node.id}
                  node={node}
                  isActive={step === node.id}
                />
              ))}
            </svg>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
