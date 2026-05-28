import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Shield, LockKeyhole, Network, HardDrive, Monitor } from 'lucide-react';

export function ProtocolUpdatePopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const hasSeenPopup = localStorage.getItem('protocol_update_seen_v2');
      if (!hasSeenPopup) {
        setIsOpen(true);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const closePopup = () => {
    setIsOpen(false);
    localStorage.setItem('protocol_update_seen_v2', 'true');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={closePopup}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-[rgba(10,10,10,0.9)] border border-orange-500/20 shadow-glow-primary max-h-[90vh] overflow-y-auto"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-orange-400 to-white" />

            <button
              onClick={closePopup}
              className="absolute right-4 top-4 rounded-full p-2 text-white/50 hover:bg-orange-500/10 hover:text-white transition-colors z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-8 sm:p-12">
              <div className="mb-6 inline-flex items-center gap-2 rounded border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-orange-400">
                <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                Protocol Update Live
              </div>

              <h2 className="mb-4 text-3xl sm:text-4xl font-bold text-white tracking-tight font-heading">
                Welcome to Blindference
              </h2>

              <p className="mb-10 text-white/50 text-sm sm:text-base leading-relaxed max-w-2xl">
                Full end-to-end confidential inference with crypto-economic guarantees, multi-agent research pipelines, and a completely overhauled developer experience.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                {[
                  {
                    icon: LockKeyhole,
                    title: '1. End-to-End Encrypted Inference',
                    desc: 'Run fully confidential text generation via Groq Llama 3 or Google Gemini. Prompts are AES-encrypted locally and keys are secured on-chain via Threshold FHE.',
                  },
                  {
                    icon: Network,
                    title: '2. 1+2 Quorum Consensus',
                    desc: 'A robust distributed architecture featuring 1 leader node and 2 verifier nodes. Crypto-economically guarantees the integrity of inference execution.',
                  },
                  {
                    icon: Shield,
                    title: '3. Onchain Risk Coverage',
                    desc: 'Fully functional hallucination insurance powered by Reineira. Disputed inferences are verified via network consensus, automatically triggering USDC payouts.',
                  },
                  {
                    icon: HardDrive,
                    title: '4. Pinata IPFS Integration',
                    desc: 'Secure, decentralized prompt storage using Pinata blobs. Isolates heavy payload data from the blockchain while ensuring absolute data immutability.',
                  },
                  {
                    icon: Monitor,
                    title: '5. Neon Orange Protocol Aesthetic',
                    desc: 'A massive frontend overhaul bringing a sleek, developer-focused dark mode experience with neon orange accents. Fluid framer-motion micro-animations and intuitive workflows tailored for web3 engineers.',
                  },
                ].map((feature) => {
                  const Icon = feature.icon
                  return (
                    <div
                      key={feature.title}
                      className="flex items-start gap-4 p-4 rounded-xl border border-white/10 bg-[rgba(10,10,10,0.6)] hover:bg-orange-500/5 transition-colors glass-card-hover"
                    >
                      <div className="rounded border border-orange-500/20 bg-orange-500/10 p-3 mt-1 text-orange-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white mb-2 tracking-wide">{feature.title}</h4>
                        <p className="text-sm text-white/50 leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-center">
                <button
                  onClick={closePopup}
                  className="w-full sm:w-auto min-w-[300px] rounded bg-orange-500 hover:bg-orange-400 px-8 py-4 text-sm font-bold uppercase tracking-widest text-white transition-colors glow-primary"
                >
                  Start Building on Blindference
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
