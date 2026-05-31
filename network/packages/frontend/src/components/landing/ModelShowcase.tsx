import { motion } from 'framer-motion';
import { Zap, Trophy, Code, Lock } from 'lucide-react';
import { fadeInUp, fadeInScale, staggerSlow } from '../../lib/animations';
import { cn } from '../../utils/helpers';

const models = [
  {
    name: 'Llama 3.3 70B',
    provider: 'Groq',
    speed: '800 tok/s',
    accuracy: '94.2%',
    badge: 'Fastest',
    Icon: Zap,
  },
  {
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    speed: '600 tok/s',
    accuracy: '96.8%',
    badge: 'Best Accuracy',
    Icon: Trophy,
  },
  {
    name: 'Qwen 2.5 7B',
    provider: 'Alibaba',
    speed: '400 tok/s',
    accuracy: '89.1%',
    badge: 'Open Source',
    Icon: Code,
  },
  {
    name: 'OPT 125M',
    provider: 'Local',
    speed: 'N/A',
    accuracy: 'Dev',
    badge: 'Private',
    Icon: Lock,
  },
];

const partners = [
  {
    name: 'Arbitrum',
    render: () => (
      <div className="flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <path d="M12 2L22 20H2L12 2Z" fill="#A855F7" />
          <path d="M12 8L16 16H8L12 8Z" fill="#000" />
        </svg>
        <span className="text-sm font-semibold tracking-wide">Arbitrum</span>
      </div>
    ),
  },
  {
    name: 'Fhenix',
    render: () => (
      <span className="text-sm font-semibold tracking-wide">Fhenix</span>
    ),
  },
  {
    name: 'Reineira',
    render: () => (
      <span className="text-sm font-semibold tracking-wide">Reineira</span>
    ),
  },
  {
    name: 'Groq',
    render: () => (
      <span className="text-sm font-bold tracking-wide">Groq</span>
    ),
  },
  {
    name: 'Google',
    render: () => (
      <div className="flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" className="shrink-0">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <text
            x="12"
            y="16"
            textAnchor="middle"
            fill="currentColor"
            fontSize="12"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            G
          </text>
        </svg>
        <span className="text-sm font-semibold tracking-wide">Google</span>
      </div>
    ),
  },
  {
    name: 'Pinata',
    render: () => (
      <span className="text-sm font-semibold tracking-wide">Pinata</span>
    ),
  },
];

export default function ModelShowcase() {
  return (
    <section className="relative py-32 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-20"
        >
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-violet-500">
            Integrations
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold font-heading text-brand-text mt-3 mb-4">
            Top Models Live on{' '}
            <span className="gradient-text">Blindference</span>
          </h2>
          <p className="text-brand-text-secondary max-w-xl mx-auto leading-relaxed">
            From frontier LLMs to efficient open-source models — all running
            inside TEEs with cryptographic proof.
          </p>
        </motion.div>

        {/* Model Grid */}
        <motion.div
          variants={staggerSlow}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {models.map((model, i) => (
            <motion.div
              key={model.name}
              variants={fadeInScale}
              transition={{ delay: i * 0.08 }}
            >
              <div
                className={cn(
                  'group relative rounded-2xl p-6 h-full flex flex-col',
                  'bg-brand-surface/60 backdrop-blur-xl border border-white/[0.08]',
                  'transition-all duration-300 ease-out',
                  'hover:border-violet-500/40',
                  'hover:shadow-[0_0_30px_rgba(139,92,246,0.12),0_8px_32px_rgba(0,0,0,0.5)]',
                  'hover:-translate-y-1'
                )}
              >
                {/* Top row: provider + badge */}
                <div className="flex items-center justify-between mb-5">
                  <span className="text-xs text-brand-text-secondary font-medium">
                    {model.provider}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 text-[11px] font-semibold text-violet-300">
                    {model.badge}
                  </span>
                </div>

                {/* Center: model name + icon */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0 group-hover:glow-violet transition-all duration-300">
                    <model.Icon className="w-5 h-5 text-violet-400" />
                  </div>
                  <h3 className="text-xl font-bold text-brand-text leading-tight font-heading">
                    {model.name}
                  </h3>
                </div>

                {/* Bottom: stats */}
                <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-brand-text-secondary/70 font-medium">
                      Speed
                    </span>
                    <span className="text-sm font-semibold text-brand-text">
                      {model.speed}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-wider text-brand-text-secondary/70 font-medium">
                      Accuracy
                    </span>
                    <span className="text-sm font-semibold text-brand-text">
                      {model.accuracy}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Partner Logos */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
          className="mt-24"
        >
          <p className="text-center text-xs uppercase tracking-[0.3em] text-brand-text-secondary/60 mb-10">
            Trusted by leading infrastructure partners
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {partners.map((partner) => (
              <motion.div
                key={partner.name}
                whileHover={{ scale: 1.05, opacity: 1 }}
                className="text-brand-text-secondary/40 hover:text-brand-text transition-all duration-300 cursor-default"
              >
                <partner.render />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
