import { motion } from "framer-motion";
import { X, ShieldCheck, Check } from "lucide-react";
import { fadeInUp, fadeInScale, staggerSlow } from "../../lib/animations";

const centralizedItems = [
  {
    text: "Your prompts stored by provider",
    subtext: "Data retained indefinitely for 'quality improvement'",
  },
  {
    text: "Prompts used for model training",
    subtext: "Your proprietary queries become training fodder",
  },
  {
    text: "No proof of execution",
    subtext: "You must trust they ran what they claimed",
  },
  {
    text: "Single point of failure",
    subtext: "One breach exposes all user data",
  },
  {
    text: "Opaque data policies",
    subtext: "Terms change without notice; opt-out buried",
  },
  {
    text: "Geographic restrictions",
    subtext: "Your data may be processed in any jurisdiction",
  },
];

const blindferenceItems = [
  {
    text: "FHE-encrypted end-to-end",
    subtext: "AES-256-GCM + CoFHE. Provider never sees plaintext.",
  },
  {
    text: "Quorum-verified consensus",
    subtext: "3 nodes execute; 2/3 hash match required. Proof on-chain.",
  },
  {
    text: "On-chain commitments",
    subtext: "Every result anchored to Arbitrum with cryptographic receipt",
  },
  {
    text: "Decentralized node network",
    subtext: "No single entity controls your data or the compute",
  },
  {
    text: "Transparent by design",
    subtext: "All verification logic is open-source and auditable",
  },
  {
    text: "User-controlled decryption",
    subtext: "Only your private key can reveal the final answer",
  },
];

export function PrivacyComparison() {
  return (
    <section className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          variants={staggerSlow}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <motion.p
            variants={fadeInUp}
            className="font-mono text-xs uppercase tracking-[0.3em] text-brand-text-secondary mb-4"
          >
            WHY BLINDFERENCE
          </motion.p>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl font-bold font-heading text-brand-text mb-4"
          >
            Privacy is{" "}
            <span className="gradient-text">Not Optional</span>
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-brand-text-secondary max-w-xl mx-auto"
          >
            See how Blindference fundamentally differs from centralized AI
            providers.
          </motion.p>
        </motion.div>

        {/* Two-column comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
          {/* Connecting vertical line on desktop */}
          <div className="hidden lg:block absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          {/* VS badge in center on desktop */}
          <div className="hidden lg:flex absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="w-10 h-10 rounded-full bg-brand-surface border border-white/10 flex items-center justify-center">
              <span className="text-[10px] font-mono font-bold text-brand-text-secondary">
                VS
              </span>
            </div>
          </div>

          {/* Left column — Centralized AI */}
          <motion.div
            variants={fadeInScale}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <X className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-sm font-mono uppercase tracking-[0.2em] text-red-300/80 font-bold">
                Centralized AI
              </h3>
            </div>

            <div className="space-y-6">
              {centralizedItems.map((item, i) => (
                <motion.div
                  key={item.text}
                  variants={fadeInUp}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex gap-3"
                >
                  <div className="mt-0.5 shrink-0">
                    <div className="w-5 h-5 rounded-full bg-red-500/10 border border-red-500/15 flex items-center justify-center">
                      <X className="w-3 h-3 text-red-400" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/70">
                      {item.text}
                    </p>
                    <p className="text-xs text-white/30 mt-0.5">{item.subtext}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right column — Blindference */}
          <motion.div
            variants={fadeInScale}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="glass-card p-8 border-white/[0.12]"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-sm font-mono uppercase tracking-[0.2em] text-emerald-300/80 font-bold">
                Blindference
              </h3>
            </div>

            <div className="space-y-6">
              {blindferenceItems.map((item, i) => (
                <motion.div
                  key={item.text}
                  variants={fadeInUp}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 + 0.1 }}
                  className="flex gap-3"
                >
                  <div className="mt-0.5 shrink-0">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/90">
                      {item.text}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">{item.subtext}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
