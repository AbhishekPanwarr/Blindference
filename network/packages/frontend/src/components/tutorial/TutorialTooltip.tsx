import { motion } from 'framer-motion'
import { ArrowRight, ArrowLeft, X, HelpCircle } from 'lucide-react'
import type { TutorialStep } from './tutorialSteps'

export function TutorialTooltip({
  targetRect,
  step,
  currentStepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: {
  targetRect: DOMRect
  step: TutorialStep
  currentStepIndex: number
  totalSteps: number
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}) {
  // Calculate tooltip position ensuring it never overlaps the target element
  const getPosition = () => {
    const gap = 80 // large gap between element and tooltip
    const tooltipWidth = 360
    const tooltipHeight = 260 // generous estimate for actual rendered height
    const margin = 16

    const vw = window.innerWidth
    const vh = window.innerHeight

    // Determine if target is in top or bottom half of screen
    const targetCenterY = targetRect.top + targetRect.height / 2
    const targetInBottomHalf = targetCenterY > vh / 2

    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
    let top: number

    // Horizontal boundary
    if (left < margin) left = margin
    if (left + tooltipWidth > vw - margin) {
      left = vw - tooltipWidth - margin
    }

    // Vertical placement: prefer placing away from screen edge
    const fitsBelow = targetRect.bottom + gap + tooltipHeight <= vh - margin
    const fitsAbove = targetRect.top - gap - tooltipHeight >= margin

    if (targetInBottomHalf && fitsAbove) {
      // Target in bottom half → place above (more room)
      top = targetRect.top - gap - tooltipHeight
    } else if (!targetInBottomHalf && fitsBelow) {
      // Target in top half → place below (more room)
      top = targetRect.bottom + gap
    } else if (fitsAbove) {
      top = targetRect.top - gap - tooltipHeight
    } else if (fitsBelow) {
      top = targetRect.bottom + gap
    } else {
      // Screen too small — try right side
      const fitsRight = targetRect.right + gap + tooltipWidth <= vw - margin
      if (fitsRight) {
        left = targetRect.right + gap
        top = Math.max(margin, targetRect.top + targetRect.height / 2 - tooltipHeight / 2)
      } else {
        left = Math.max(margin, targetRect.left - gap - tooltipWidth)
        top = Math.max(margin, targetRect.top + targetRect.height / 2 - tooltipHeight / 2)
      }
    }

    // Final clamp
    if (top < margin) top = margin
    if (top + tooltipHeight > vh - margin) {
      top = vh - tooltipHeight - margin
    }

    return { left, top }
  }

  const pos = getPosition()
  const isFirst = currentStepIndex === 0
  const isLast = currentStepIndex === totalSteps - 1

  return (
    <motion.div
      className="fixed z-[101] pointer-events-auto"
      style={{ left: pos.left, top: pos.top, width: 360 }}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Glass tooltip card — smooth, curvy boundary */}
      <div className="relative rounded-[2rem] bg-[#060606]/95 backdrop-blur-2xl border border-white/[0.1] shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Top shimmer line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />

        {/* Corner glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-violet-500/8 blur-3xl" />

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Header: step number + title */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="flex items-start gap-3"
          >
            <div className="shrink-0 w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <HelpCircle className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-violet-400/80 uppercase tracking-[0.15em] mb-0.5">
                Step {currentStepIndex + 1} of {totalSteps}
              </div>
              <h3 className="text-[15px] font-bold text-white tracking-tight leading-snug">
                {step.title}
              </h3>
            </div>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.3 }}
            className="text-[13px] text-white/50 leading-relaxed"
          >
            {step.description}
          </motion.p>

          {/* Actions row */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.3 }}
            className="flex items-center justify-between pt-2"
          >
            {/* Progress dots */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStepIndex
                      ? 'w-4 bg-violet-500'
                      : i < currentStepIndex
                      ? 'w-1.5 bg-white/40'
                      : 'w-1.5 bg-white/15'
                  }`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={onPrev}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-white/50 hover:text-white hover:bg-white/[0.05] transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
              )}

              <button
                onClick={onSkip}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all"
              >
                <X className="w-3.5 h-3.5 inline mr-1" />
                Skip
              </button>

              <button
                onClick={onNext}
                className="group relative flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-violet-500 text-white text-xs font-semibold overflow-hidden transition-all hover:scale-[1.03] hover:bg-violet-400 shadow-[0_4px_20px_rgba(139,92,246,0.3)]"
              >
                <span className="relative z-10">{isLast ? 'Finish' : 'Next'}</span>
                <ArrowRight className="w-3.5 h-3.5 relative z-10" />
                {/* Shimmer sweep */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
