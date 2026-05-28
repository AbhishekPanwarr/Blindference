import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, FileText } from "lucide-react";
import { fadeInUp, fadeInScale, staggerSlow } from "../../lib/animations";

export function FinalCTA() {
  return (
    <section className="relative py-32 px-6 overflow-hidden">
      {/* Atmospheric orange glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: "600px",
            height: "600px",
            background:
              "radial-gradient(circle, rgba(249,115,22,0.08) 0%, rgba(249,115,22,0.03) 40%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
      </div>

      <motion.div
        variants={staggerSlow}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="relative z-10 max-w-4xl mx-auto text-center"
      >
        <motion.p
          variants={fadeInUp}
          className="font-mono text-xs uppercase tracking-[0.3em] text-brand-primary mb-6"
        >
          THE FINAL FRONTIER
        </motion.p>

        <motion.h2
          variants={fadeInUp}
          className="text-4xl sm:text-5xl md:text-6xl font-bold font-heading text-white mb-6 leading-tight"
        >
          Confidential AI.
          <br />
          <span className="gradient-text">Verified.</span>
        </motion.h2>

        <motion.p
          variants={fadeInUp}
          className="text-lg md:text-xl text-brand-text-secondary max-w-2xl mx-auto mb-12 leading-relaxed"
        >
          Join the network where privacy is not a feature, but a fundamental
          right. Secure your inference with zero-knowledge technology.
        </motion.p>

        <motion.div
          variants={fadeInScale}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link
            to="/app"
            className="group inline-flex items-center gap-2 bg-white text-black font-bold text-sm rounded-full px-8 py-4 transition-all hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(249,115,22,0.35)]"
          >
            Launch App
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <Link
            to="/docs"
            className="inline-flex items-center gap-2 glass-card glass-card-hover text-white font-semibold text-sm rounded-full px-8 py-4 border border-white/10"
          >
            <FileText className="w-4 h-4 text-brand-text-secondary" />
            Read Documentation
          </Link>
        </motion.div>

        {/* Bottom trust line */}
        <motion.div
          variants={fadeInUp}
          className="flex items-center justify-center gap-2"
        >
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-text-secondary/60">
              Secured by Arbitrum + Fhenix + Reineira
            </span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
