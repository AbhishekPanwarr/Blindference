import { GlobePulse } from './GlobePulse'

const heroMarkers = [
  { id: 'blindference-london', location: [51.5072, -0.1276] as [number, number], delay: 0 },
  { id: 'blindference-new-york', location: [40.7128, -74.006] as [number, number], delay: 0.45 },
  { id: 'blindference-singapore', location: [1.3521, 103.8198] as [number, number], delay: 0.9 },
  { id: 'blindference-mumbai', location: [19.076, 72.8777] as [number, number], delay: 1.35 },
  { id: 'blindference-sf', location: [37.7749, -122.4194] as [number, number], delay: 1.8 },
  { id: 'blindference-dubai', location: [25.2048, 55.2708] as [number, number], delay: 2.25 },
  { id: 'blindference-tokyo', location: [35.6895, 139.6917] as [number, number], delay: 2.7 },
]

interface DottedGlobeProps {
  className?: string
  globeClassName?: string
}

export default function DottedGlobe({ className = '', globeClassName = '' }: DottedGlobeProps) {
  return (
    <div className={`relative mx-auto aspect-square w-full max-w-[360px] sm:max-w-[500px] md:max-w-[620px] lg:max-w-[760px] ${className}`}>
      {/* Background glow */}
      <div className="absolute inset-[14%] rounded-full bg-violet-500/8 blur-[110px] md:blur-[150px]" />
      <div className="absolute inset-[11%] rounded-full bg-violet-400/5 blur-[80px] md:blur-[100px]" />

      {/* Orbital ellipses */}
      <div
        className="absolute top-[35%] right-[20%] rounded-full pointer-events-none hidden lg:block"
        style={{
          width: 400,
          height: 400,
          marginTop: -200,
          marginRight: -200,
          border: '1.5px dashed rgba(255, 255, 255, 0.1)',
          animation: 'hero-orbit-1 28s linear infinite',
          transformStyle: 'preserve-3d',
        }}
      />
      <div
        className="absolute top-[35%] right-[20%] rounded-full pointer-events-none hidden lg:block"
        style={{
          width: 320,
          height: 320,
          marginTop: -160,
          marginRight: -160,
          border: '1px solid rgba(255, 255, 255, 0.06)',
          animation: 'hero-orbit-2 22s linear infinite reverse',
          transformStyle: 'preserve-3d',
        }}
      />

      {/* Floating city labels */}
      {[
        { label: 'London', top: '29%', right: '20%', delay: '0s' },
        { label: 'New York', top: '15%', right: '32%', delay: '1s' },
        { label: 'Singapore', top: '30%', right: '2%', delay: '2s' },
        { label: 'Dubai', top: '28%', right: '40%', delay: '3s' },
        { label: 'San Francisco', top: '48%', right: '3%', delay: '4s' },
        { label: 'Mumbai', top: '45%', right: '32%', delay: '5s' },
        { label: 'Tokyo', top: '52%', right: '14%', delay: '6s' },
      ].map((city, i) => (
        <div
          key={city.label}
          className="absolute flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-xl pointer-events-none whitespace-nowrap hidden lg:flex"
          style={{
            top: city.top,
            right: city.right,
            animation: `hf-float-${(i % 4) + 1} ${8 + i * 0.5}s ease-in-out infinite`,
            zIndex: 3,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: '#8B5CF6',
              boxShadow: '0 0 8px #8B5CF6',
            }}
          />
          <span className="text-[11px] font-semibold text-white/75 tracking-wide">
            {city.label}
          </span>
        </div>
      ))}

      <div className="pointer-events-none absolute inset-[12%] rounded-full">
        <GlobePulse
          className={`h-full w-full opacity-85 drop-shadow-[0_0_65px_rgba(139,92,246,0.12)] ${globeClassName}`}
          markers={heroMarkers}
          speed={0.0024}
        />
      </div>
    </div>
  )
}
