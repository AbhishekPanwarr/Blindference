import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export default function AnimatedBanner() {
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end end'],
  })

  const scale = useTransform(scrollYProgress, [0, 0.6], [0.92, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0.4, 1])
  const domeY = useTransform(scrollYProgress, [0, 0.8], ['30%', '0%'])

  return (
    <section className="relative py-24 px-6" ref={containerRef}>
      <motion.div
        style={{ scale, opacity }}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] shadow-2xl"
      >
        {/* Background container */}
        <div className="relative aspect-[16/9] w-full bg-[#0c0c0e]">
          {/* Subtle grid lines */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)',
              backgroundSize: '80px 80px',
            }}
          />

          {/* Scanline overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              background:
                'linear-gradient(to bottom, transparent 50%, rgba(249, 115, 22, 0.02) 51%, transparent 100%)',
              backgroundSize: '100% 3px',
            }}
          />

          {/* Orange dome / glow */}
          <motion.div
            style={{ y: domeY }}
            className="absolute inset-x-0 bottom-0 flex items-end justify-center pointer-events-none"
          >
            {/* Multiple overlapping gradient layers for depth */}
            {/* Layer 1: deep base glow */}
            <div
              className="absolute bottom-[-20%] left-1/2 -translate-x-1/2 w-[140%] h-[80%] rounded-t-[100%]"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 100%, rgba(249,115,22,0.35) 0%, rgba(249,115,22,0.12) 40%, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />

            {/* Layer 2: mid dome */}
            <div
              className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[110%] aspect-[2/1] rounded-t-[100%]"
              style={{
                background:
                  'linear-gradient(to top, rgba(249,115,22,0.55) 0%, rgba(251,146,60,0.35) 30%, rgba(253,186,116,0.15) 60%, transparent 100%)',
                filter: 'blur(24px)',
              }}
            />

            {/* Layer 3: bright core */}
            <div
              className="absolute bottom-[-5%] left-1/2 -translate-x-1/2 w-[90%] aspect-[2.2/1] rounded-t-[100%]"
              style={{
                background:
                  'linear-gradient(to top, rgba(249,115,22,0.7) 0%, rgba(251,146,60,0.45) 25%, rgba(253,186,116,0.2) 55%, transparent 100%)',
                filter: 'blur(16px)',
              }}
            />

            {/* Layer 4: hot center strip */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-[35%] rounded-t-[100%]"
              style={{
                background:
                  'linear-gradient(to top, rgba(255,160,60,0.5) 0%, rgba(249,115,22,0.3) 40%, transparent 100%)',
                filter: 'blur(12px)',
              }}
            />
          </motion.div>

          {/* Content overlay */}
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-8 text-center">
            <h2 className="max-w-4xl text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.5rem]">
              CoFHE Encryption in Action
            </h2>

            <p className="mt-5 max-w-2xl text-sm font-light leading-relaxed tracking-wide text-white/50 sm:text-base md:text-lg">
              Every prompt is sealed before it leaves your browser. The quorum
              decrypts inside TEEs. The result is proven on-chain.
            </p>

            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
              {/* Primary CTA */}
              <Link
                to="/app"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-black transition-all hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)]"
              >
                Explore Product
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>

              {/* Secondary CTA — glass outline */}
              <Link
                to="/docs"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-7 py-3 text-sm font-semibold text-white/80 backdrop-blur-[24px] transition-all hover:border-white/30 hover:bg-white/[0.06] hover:text-white"
              >
                Developer Portal
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
