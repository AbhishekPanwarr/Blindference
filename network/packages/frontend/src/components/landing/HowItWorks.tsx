import { motion } from "framer-motion";
import { Lock, Cpu, Wallet } from "lucide-react";
import { GlassCard } from "../../components/ui/GlassCard";
import { fadeInUp, staggerSlow } from "../../lib/animations";

const steps = [
  {
    icon: Lock,
    title: "Encrypt",
    description:
      "Your prompt is AES-256-GCM encrypted before it leaves your device. The decryption key is split and stored on-chain, gated to the quorum by Fhenix CoFHE.",
    stepLabel: "01 // AES-256-GCM",
  },
  {
    icon: Cpu,
    title: "Verify",
    description:
      "Three independent nodes run the same model on the encrypted input. Their outputs are hashed and compared on-chain — at least 2/3 must match for the result to be accepted.",
    stepLabel: "02 // Consensus Hash",
  },
  {
    icon: Wallet,
    title: "Settle",
    description:
      "Payment is held in a Reineira escrow. It releases to nodes only when the quorum verifies the result. No truth, no payout. Optional insurance covers you if the system fails.",
    stepLabel: "03 // Escrow Release",
  },
];

export default function HowItWorks() {
  return (
    <section className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          variants={staggerSlow}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-20"
        >
          <motion.p
            variants={fadeInUp}
            className="font-mono text-xs uppercase tracking-[0.25em] text-violet-500 mb-4"
          >
            HOW BLINDFERENCE WORKS
          </motion.p>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6"
          >
            Privacy, Verification, Settlement — All Automated
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-brand-text-secondary max-w-2xl mx-auto text-base md:text-lg"
          >
            A secure infrastructure designed for confidential AI processing,
            guaranteeing data privacy through cryptography and decentralized
            consensus.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connecting gradient line on desktop */}
          <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-violet-500/30 via-violet-400/20 to-violet-500/10" />

          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              variants={fadeInUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.15 }}
              className="relative"
            >
              <GlassCard
                initial={false}
                className="p-8 h-full flex flex-col text-center"
                hoverEffect
              >
                <div className="w-14 h-14 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-6 glow-violet">
                  <step.icon className="w-6 h-6 text-violet-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3 font-heading">
                  {step.title}
                </h3>
                <p className="text-sm text-brand-text-secondary leading-relaxed flex-1">
                  {step.description}
                </p>
                <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-violet-500/70">
                  {step.stepLabel}
                </p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
