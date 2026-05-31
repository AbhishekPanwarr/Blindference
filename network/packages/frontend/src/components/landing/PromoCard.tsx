import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, FileText } from 'lucide-react'

const easePremium: [number, number, number, number] = [0.22, 1, 0.36, 1]

export default function PromoCard() {
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end end'],
  })

  const scale = useTransform(scrollYProgress, [0, 0.6], [0.88, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0, 1])
  const domeY = useTransform(scrollYProgress, [0, 0.8], ['40%', '0%'])

  return (
    <section ref={containerRef} className="relative z-20 overflow-hidden px-4 py-16 md:px-8 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <motion.div
          style={{ scale, opacity }}
          className="relative min-h-[420px] overflow-hidden rounded-[2.5rem] border border-white/[0.04] bg-[#0c0c0e] shadow-2xl"
        >
          {/* Subtle vertical grid lines */}
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px)',
              backgroundSize: '8% 100%',
            }}
          />

          {/* Top shimmer line */}
          <div className="absolute left-1/2 top-0 h-px w-4/5 -translate-x-1/2 bg-gradient-to-r from-transparent via-fuchsia-500/20 to-transparent" />

          {/* Purple-blue dome glow — bottom right, NullPay style */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 top-[42%] overflow-hidden rounded-b-[2.5rem]">
            <motion.div style={{ y: domeY }} className="relative h-full w-full">
              <motion.div
                animate={{ scale: [1, 1.05, 1], rotate: [-0.5, 0.5, -0.5] }}
                transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute left-1/2 top-0 aspect-[2/1] w-[160%] -translate-x-1/2 rounded-t-[100%] md:w-[130%]"
                style={{
                  background: 'linear-gradient(90deg, #E879F9 0%, #A855F7 30%, #8B5CF6 60%, #6366F1 100%)',
                  filter: 'blur(16px)',
                  boxShadow: '0 -20px 80px rgba(139, 92, 246, 0.25)',
                }}
              />
              <motion.div
                animate={{ scale: [1, 1.02, 1], rotate: [-0.3, 0.3, -0.3] }}
                transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute left-1/2 top-[4%] aspect-[2/1] w-[158%] -translate-x-1/2 rounded-t-[100%] md:w-[128%]"
                style={{
                  background: 'linear-gradient(90deg, #F0ABFC 0%, #C084FC 30%, #8B5CF6 60%, #3B82F6 100%)',
                }}
              />
            </motion.div>
          </div>

          {/* Content overlay */}
          <div className="relative z-10 flex min-h-[420px] flex-col items-center justify-center px-6 py-10 text-center sm:px-10 lg:px-16">
            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.8, delay: 0.2, ease: easePremium }}
              className="mx-auto max-w-4xl text-center text-4xl font-medium leading-[1.05] tracking-tight text-white md:text-5xl lg:text-[3.7rem]"
            >
              Confidential inference
              <br />
              that actually protects you.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.8, delay: 0.28, ease: easePremium }}
              className="mx-auto mt-5 max-w-2xl text-center text-base font-medium leading-7 text-white/70 md:text-lg"
            >
              Encrypted prompts, quorum-verified results, and on-chain settlement
              with optional insurance.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.8, delay: 0.36, ease: easePremium }}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
            >
              <Link
                to="/app"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black shadow-[0_0_30px_rgba(139,92,246,0.3)] transition-all duration-300 hover:scale-105 hover:bg-violet-50"
              >
                Launch App
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/whitepaper"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-8 py-3.5 text-sm font-semibold text-white/85 backdrop-blur-xl transition-all duration-300 hover:border-violet-400/25 hover:bg-white/[0.08] hover:text-white"
              >
                <FileText className="h-4 w-4" />
                Read Whitepaper
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
