import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TutorialTooltip } from './TutorialTooltip'
import { useTutorialContext } from './TutorialContext'
import { INFERENCE_TUTORIAL_STEPS, type TutorialStep } from './tutorialSteps'

const HIGHLIGHT_CLASS = 'tutorial-highlight'

export function TutorialManager({ pageId }: { pageId: string }) {
  // Only run on inference page
  if (pageId !== 'app') return null

  const { enabled, inferenceSeen, markInferenceSeen } = useTutorialContext()
  const [active, setActive] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const prevSelectorRef = useRef<string | null>(null)

  const currentStep = INFERENCE_TUTORIAL_STEPS[currentStepIndex]
  const totalSteps = INFERENCE_TUTORIAL_STEPS.length

  // Auto-start after delay if first visit and enabled
  useEffect(() => {
    if (!enabled || inferenceSeen) return

    const timer = setTimeout(() => {
      setActive(true)
      setCurrentStepIndex(0)
    }, 1200)
    return () => clearTimeout(timer)
  }, [enabled, inferenceSeen])

  // Highlight target element and track its position
  useEffect(() => {
    if (!active || !currentStep) {
      // Clean up previous highlight
      if (prevSelectorRef.current) {
        const prevEl = document.querySelector(prevSelectorRef.current)
        if (prevEl) {
          prevEl.classList.remove(HIGHLIGHT_CLASS)
          // Remove inline z-index
          const el = prevEl as HTMLElement
          el.style.removeProperty('position')
          el.style.removeProperty('z-index')
        }
      }
      prevSelectorRef.current = null
      setTargetRect(null)
      return
    }

    // Remove highlight from previous element
    if (prevSelectorRef.current && prevSelectorRef.current !== currentStep.targetSelector) {
      const prevEl = document.querySelector(prevSelectorRef.current)
      if (prevEl) {
        prevEl.classList.remove(HIGHLIGHT_CLASS)
        const el = prevEl as HTMLElement
        el.style.removeProperty('position')
        el.style.removeProperty('z-index')
      }
    }

    // Add highlight to current element
    const updateHighlight = () => {
      const el = document.querySelector(currentStep.targetSelector)
      if (el) {
        el.classList.add(HIGHLIGHT_CLASS)
        // Ensure element has a stacking context for z-index to work
        const hel = el as HTMLElement
        const computed = window.getComputedStyle(hel)
        if (computed.position === 'static') {
          hel.style.position = 'relative'
        }
        hel.style.zIndex = '60'
        setTargetRect(el.getBoundingClientRect())
        prevSelectorRef.current = currentStep.targetSelector
      }
    }

    updateHighlight()

    window.addEventListener('resize', updateHighlight)
    window.addEventListener('scroll', updateHighlight, true)

    // Retry if element not found yet
    const retry = setInterval(updateHighlight, 300)
    const clearRetry = setTimeout(() => clearInterval(retry), 3000)

    return () => {
      window.removeEventListener('resize', updateHighlight)
      window.removeEventListener('scroll', updateHighlight, true)
      clearInterval(retry)
      clearTimeout(clearRetry)
    }
  }, [active, currentStep])

  // Cleanup on unmount or when tutorial ends
  useEffect(() => {
    return () => {
      if (prevSelectorRef.current) {
        const el = document.querySelector(prevSelectorRef.current)
        if (el) {
          el.classList.remove(HIGHLIGHT_CLASS)
          const hel = el as HTMLElement
          hel.style.removeProperty('position')
          hel.style.removeProperty('z-index')
        }
      }
    }
  }, [])

  const handleNext = useCallback(() => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((i) => i + 1)
    } else {
      setActive(false)
      markInferenceSeen()
    }
  }, [currentStepIndex, totalSteps, markInferenceSeen])

  const handlePrev = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((i) => i - 1)
    }
  }, [currentStepIndex])

  const handleSkip = useCallback(() => {
    setActive(false)
    markInferenceSeen()
  }, [markInferenceSeen])

  if (!active || !currentStep || !targetRect) {
    return null
  }

  return (
    <AnimatePresence>
      <TutorialOverlay
        key={`app-${currentStepIndex}`}
        targetRect={targetRect}
        step={currentStep}
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleSkip}
      />
    </AnimatePresence>
  )
}

/* ─── Backdrop + Tooltip ─── */
function TutorialOverlay({
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
  return (
    <motion.div
      className="fixed inset-0 z-[70] pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Dark backdrop — visual only, doesn't block clicks */}
      <div
        className="absolute inset-0 bg-black/50 pointer-events-none"
      />

      {/* Tooltip floats above everything */}
      <div className="pointer-events-auto">
        <TutorialTooltip
          targetRect={targetRect}
          step={step}
          currentStepIndex={currentStepIndex}
          totalSteps={totalSteps}
          onNext={onNext}
          onPrev={onPrev}
          onSkip={onSkip}
        />
      </div>
    </motion.div>
  )
}
