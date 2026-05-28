import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react"
import createGlobe from "cobe"

interface PulseMarker {
  id: string
  location: [number, number]
  delay: number
}

interface GlobePulseProps {
  markers?: PulseMarker[]
  className?: string
  speed?: number
}

const defaultMarkers: PulseMarker[] = [
  { id: "pulse-1", location: [51.51, -0.13], delay: 0 },
  { id: "pulse-2", location: [40.71, -74.01], delay: 0.5 },
  { id: "pulse-3", location: [35.68, 139.65], delay: 1 },
  { id: "pulse-4", location: [-33.87, 151.21], delay: 1.5 },
]

export function GlobePulse({
  markers = defaultMarkers,
  className,
  speed = 0.003,
}: GlobePulseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const targetOffset = useRef({ phi: 0, theta: 0 })
  const currentOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)

  const handlePointerMove = useCallback((event: PointerEvent | ReactPointerEvent<HTMLCanvasElement>) => {
    if (typeof window === "undefined" || !window.innerWidth || !window.innerHeight) {
      return
    }

    const normalizedX = event.clientX / window.innerWidth - 0.5
    const normalizedY = event.clientY / window.innerHeight - 0.5

    targetOffset.current = {
      phi: normalizedX * 2.45,
      theta: normalizedY * 1.05,
    }
  }, [])

  useEffect(() => {
    const handlePointerLeave = () => {
      targetOffset.current = { phi: 0, theta: 0 }
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("mouseleave", handlePointerLeave, { passive: true })

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("mouseleave", handlePointerLeave)
      targetOffset.current = { phi: 0, theta: 0 }
      currentOffset.current = { phi: 0, theta: 0 }
    }
  }, [handlePointerMove])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    let globe: ReturnType<typeof createGlobe> | null = null
    let animationId = 0
    let revealTimeout = 0
    let resizeObserver: ResizeObserver | null = null
    let phi = 0

    const syncSize = () => {
      const width = canvas.offsetWidth
      if (!globe || width === 0) {
        return
      }

      globe.update({
        width,
        height: width,
      })
    }

    const init = () => {
      const width = canvas.offsetWidth
      if (width === 0 || globe) {
        return
      }

      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width,
        height: width,
        phi: 0,
        theta: 0.2,
        dark: 1,
        diffuse: 1.5,
        mapSamples: 16000,
        mapBrightness: 10,
        baseColor: [0.5, 0.5, 0.5],
        markerColor: [0.98, 0.45, 0.09],
        glowColor: [0.05, 0.05, 0.05],
        markerElevation: 0,
        markers: markers.map((marker) => ({
          id: marker.id,
          location: marker.location,
          size: 0.025,
        })),
        arcs: [],
        arcColor: [0.98, 0.45, 0.09],
        arcWidth: 0.5,
        arcHeight: 0.25,
        opacity: 0.7,
      })

      const animate = () => {
        phi += speed

        currentOffset.current = {
          phi:
            currentOffset.current.phi +
            (targetOffset.current.phi - currentOffset.current.phi) * 0.12,
          theta:
            currentOffset.current.theta +
            (targetOffset.current.theta - currentOffset.current.theta) * 0.12,
        }

        globe?.update({
          phi: phi + phiOffsetRef.current + currentOffset.current.phi,
          theta: 0.2 + thetaOffsetRef.current + currentOffset.current.theta,
        })

        animationId = window.requestAnimationFrame(animate)
      }

      animate()
      revealTimeout = window.setTimeout(() => {
        if (canvas) {
          canvas.style.opacity = "1"
        }
      }, 30)
    }

    if (canvas.offsetWidth > 0) {
      init()
    }

    resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0]) {
        return
      }

      if (!globe && entries[0].contentRect.width > 0) {
        init()
        return
      }

      syncSize()
    })

    resizeObserver.observe(canvas)

    return () => {
      if (animationId) {
        window.cancelAnimationFrame(animationId)
      }
      if (revealTimeout) {
        window.clearTimeout(revealTimeout)
      }
      resizeObserver?.disconnect()
      globe?.destroy()
    }
  }, [markers, speed])

  return (
    <div className={`relative aspect-square select-none ${className || ""}`}>
      <style>{`
        @keyframes pulse-expand {
          0% { transform: scaleX(0.3) scaleY(0.3); opacity: 0.8; }
          100% { transform: scaleX(1.5) scaleY(1.5); opacity: 0; }
        }
      `}</style>

      <canvas
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        style={{
          width: "100%",
          height: "100%",
          cursor: "default",
          opacity: 0,
          transition: "opacity 1.2s ease",
          borderRadius: "50%",
          touchAction: "none",
        }}
      />

      {/* Positioned markers around the globe */}
      {markers.map((marker) => {
        const positions: Record<string, { top: string; left: string }> = {
          "pulse-1": { top: "25%", left: "48%" },   // London
          "pulse-2": { top: "32%", left: "25%" },   // NYC
          "pulse-3": { top: "38%", left: "82%" },   // Tokyo
          "pulse-4": { top: "72%", left: "88%" },   // Sydney
        }
        const pos = positions[marker.id] || { top: "50%", left: "50%" }

        return (
          <div
            key={marker.id}
            className="absolute flex items-center justify-center"
            style={{
              top: pos.top,
              left: pos.left,
              width: 40,
              height: 40,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                position: "absolute",
                inset: 0,
                border: "2px solid #f97316",
                borderRadius: "50%",
                opacity: 0,
                animation: `pulse-expand 2s ease-out infinite ${marker.delay}s`,
              }}
            />
            <span
              style={{
                position: "absolute",
                inset: 0,
                border: "2px solid #f97316",
                borderRadius: "50%",
                opacity: 0,
                animation: `pulse-expand 2s ease-out infinite ${marker.delay + 0.5}s`,
              }}
            />
            <span
              style={{
                width: 10,
                height: 10,
                background: "#f97316",
                borderRadius: "50%",
                boxShadow: "0 0 0 3px #111, 0 0 0 5px #f97316",
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
