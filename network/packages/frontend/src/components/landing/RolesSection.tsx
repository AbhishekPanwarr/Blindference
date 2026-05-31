import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Server, Code, ShieldCheck, ArrowRight } from "lucide-react";
import { fadeInUp, fadeInScale, staggerSlow } from "../../lib/animations";

const roles = [
  {
    icon: Server,
    title: "Run a Node",
    description:
      "Install the blindference-node package, stake 1000 BLIND, and earn rewards for every verified inference your machine processes. No plaintext ever touches your disk.",
    stats: ["Earn BLIND per job", "60% leader / 20% per verifier", "72h dispute window"],
    cta: "Join as a Node",
    href: "/nodes",
    variant: "outline" as const,
  },
  {
    icon: Code,
    title: "Build with Agents",
    description:
      "Use the @blindference/agent-sdk TypeScript library to integrate confidential inference into your own dApps, trading bots, or governance agents. Pre-funded credit wallets handle payments automatically.",
    stats: [
      "npm install @blindference/agent-sdk",
      "20% discount with BLIND",
      "Full CoFHE encryption",
    ],
    cta: "Agent SDK Docs",
    href: "/docs",
    variant: "outline" as const,
  },
  {
    icon: ShieldCheck,
    title: "Get Verified Answers",
    description:
      "Ask any question, get an answer backed by cryptographic proof. Your prompt stays private. Your result is guaranteed by quorum consensus and economic incentives.",
    stats: ["Pay-per-call or credit packages", "cUSDC or BLIND", "Insure your query for 2%"],
    cta: "Launch App",
    href: "/app",
    variant: "primary" as const,
  },
];

export function RolesSection() {
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
            FOR EVERY ROLE
          </motion.p>
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl font-bold font-heading text-brand-text mb-4"
          >
            Blindference empowers everyone in the{" "}
            <span className="gradient-text">AI economy</span>
          </motion.h2>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {roles.map((role, i) => (
            <motion.div
              key={role.title}
              variants={fadeInScale}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
            >
              <div className="glass-card glass-card-hover p-8 h-full flex flex-col relative gradient-accent-top">
                <div className="w-12 h-12 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mb-6 glow-primary">
                  <role.icon className="w-6 h-6 text-brand-secondary" />
                </div>

                <h3 className="text-xl font-bold text-brand-text mb-3 font-heading">
                  {role.title}
                </h3>

                <p className="text-sm text-brand-text-secondary leading-relaxed mb-6 flex-1">
                  {role.description}
                </p>

                {/* Stats */}
                <div className="flex flex-wrap gap-2 mb-8">
                  {role.stats.map((stat) => (
                    <span
                      key={stat}
                      className="font-mono text-[10px] text-brand-text-secondary/60 bg-white/[0.03] border border-white/[0.06] rounded-md px-2 py-1"
                    >
                      {stat}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                {role.variant === "primary" ? (
                  <Link
                    to={role.href}
                    className="inline-flex items-center justify-center gap-2 bg-white text-black font-bold text-sm rounded-full px-6 py-3 transition-all hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(255,255,255,0.25)]"
                  >
                    {role.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <Link
                    to={role.href}
                    className="inline-flex items-center justify-center gap-2 btn-outline text-xs rounded-full"
                  >
                    {role.cta}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
