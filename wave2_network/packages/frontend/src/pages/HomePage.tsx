import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export function HomePage() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col items-start w-full max-w-5xl mx-auto pt-24 pb-32 px-6"
    >
      <motion.div variants={itemVariants} className="mb-6">
        <span className="text-gray-500 font-mono text-[10px] tracking-[0.2em] uppercase">Build on Fhenix</span>
      </motion.div>

      <motion.h1 variants={itemVariants} className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-medium tracking-tight text-white leading-[1.05] max-w-4xl mb-12">
        Build the next generation of <span className="text-emerald-500 font-bold">onchain AI</span> with the fastest FHE execution network
      </motion.h1>

      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center gap-6 mt-4 mb-32 w-full sm:w-auto">
        <Link
          to="/inference/new"
          className="flex items-center gap-2 bg-emerald-500 text-black hover:bg-emerald-400 px-8 py-4 rounded-xl font-bold transition-all text-sm group w-full sm:w-auto justify-center"
        >
          Start Inference
        </Link>
        <a
          href="https://cofhe-docs.fhenix.zone/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 bg-transparent text-white border border-white/20 hover:bg-white/5 px-8 py-4 rounded-xl font-bold transition-all text-sm w-full sm:w-auto justify-center"
        >
          Read docs
        </a>
      </motion.div>

      <motion.div variants={itemVariants} className="w-full">
        <div className="mb-8">
          <span className="text-gray-500 font-mono text-[10px] tracking-[0.2em] uppercase">Stack</span>
        </div>

        <div className="flex flex-col border-t border-white/10">

          <Link to="/inference/new" className="group flex flex-col sm:flex-row sm:items-center justify-between py-10 border-b border-white/10 hover:bg-white/[0.02] transition-colors -mx-6 px-6">
            <div className="flex items-start gap-8 sm:gap-16">
              <span className="text-4xl sm:text-5xl font-mono text-gray-500">01</span>
              <div>
                <h3 className="text-3xl sm:text-4xl font-medium text-white mb-3 group-hover:text-emerald-500 transition-colors">Compute</h3>
                <p className="text-gray-400 text-sm max-w-md">Decentralized FHE inference, priced for builders.</p>
              </div>
            </div>
            <div className="mt-6 sm:mt-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center text-sm font-mono text-white">
              Start <ArrowRight className="w-4 h-4 ml-2" />
            </div>
          </Link>

          <div className="group flex flex-col sm:flex-row sm:items-center justify-between py-10 border-b border-white/10 hover:bg-white/[0.02] transition-colors -mx-6 px-6 cursor-not-allowed opacity-60">
            <div className="flex items-start gap-8 sm:gap-16">
              <span className="text-4xl sm:text-5xl font-mono text-gray-500">02</span>
              <div>
                <h3 className="text-3xl sm:text-4xl font-medium text-white mb-3">Storage</h3>
                <p className="text-gray-400 text-sm max-w-md">Fast, decentralized storage for AI workloads.</p>
              </div>
            </div>
            <div className="mt-6 sm:mt-0 opacity-0 flex items-center text-sm font-mono text-white">
              Coming soon <ArrowRight className="w-4 h-4 ml-2" />
            </div>
          </div>

          <div className="group flex flex-col sm:flex-row sm:items-center justify-between py-10 border-b border-white/10 hover:bg-white/[0.02] transition-colors -mx-6 px-6 cursor-not-allowed opacity-60">
            <div className="flex items-start gap-8 sm:gap-16">
              <span className="text-4xl sm:text-5xl font-mono text-gray-500">03</span>
              <div>
                <h3 className="text-3xl sm:text-4xl font-medium text-white mb-3">Quorum</h3>
                <p className="text-gray-400 text-sm max-w-md">Crypto-economically verified consensus network.</p>
              </div>
            </div>
            <div className="mt-6 sm:mt-0 opacity-0 flex items-center text-sm font-mono text-white">
              Coming soon <ArrowRight className="w-4 h-4 ml-2" />
            </div>
          </div>

        </div>
      </motion.div>
    </motion.div>
  );
}
