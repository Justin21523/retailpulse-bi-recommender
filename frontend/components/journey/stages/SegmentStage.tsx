'use client'
import { useEffect, useState } from 'react'

const CLUSTERS = [
  { label: 'Champions', color: '#22c55e', cx: 75,  cy: 38,  count: '1,240' },
  { label: 'Loyal',     color: '#3b82f6', cx: 195, cy: 48,  count: '1,182' },
  { label: 'At Risk',   color: '#f59e0b', cx: 80,  cy: 128, count: '1,045' },
  { label: 'Lost',      color: '#ef4444', cx: 195, cy: 138, count: '871'   },
]

const DOTS = Array.from({ length: 50 }, (_, i) => {
  const cluster = i % 4
  return { cluster, initialX: 20 + (i * 37) % 230, initialY: 10 + (i * 31) % 155 }
})

const JITTER = DOTS.map((_, i) => ({
  x: ((i * 17) % 40) - 20,
  y: ((i * 13) % 40) - 20,
}))

// Dot grid pattern as SVG defs
const DOT_GRID = Array.from({ length: 6 }, (_, row) =>
  Array.from({ length: 9 }, (_, col) => ({ x: col * 30 + 5, y: row * 28 + 10 }))
).flat()

export function SegmentStage({ active }: { active: boolean }) {
  const [clustered, setClustered] = useState(false)
  const [showLabels, setShowLabels] = useState(false)
  const [showRipple, setShowRipple] = useState(false)

  useEffect(() => {
    setClustered(false)
    setShowLabels(false)
    setShowRipple(false)
    if (!active) return
    const t1 = setTimeout(() => setClustered(true), 400)
    const t2 = setTimeout(() => setShowRipple(true), 900)
    const t3 = setTimeout(() => setShowLabels(true), 1500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [active])

  return (
    <div className="w-full relative" style={{ height: 185 }}>
      <svg width="100%" height="185" viewBox="0 0 270 185">
        {/* Dot grid background (feature space) */}
        {DOT_GRID.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={1} fill="currentColor" className="text-muted-foreground/10" />
        ))}

        {/* Ripple rings when clusters form */}
        {showRipple && CLUSTERS.map((c, i) => (
          <circle
            key={`ripple-${i}`}
            cx={c.cx} cy={c.cy} r={12}
            fill="none"
            stroke={c.color}
            strokeWidth={1.5}
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
              animation: `ripple-ring 0.9s ease ${i * 120}ms both`,
            }}
          />
        ))}

        {/* Cluster label badges */}
        {CLUSTERS.map((c, i) => (
          <g key={i} style={{ opacity: showLabels ? 1 : 0, transition: 'opacity 0.5s ease' }}>
            <rect x={c.cx - 24} y={c.cy - 11} width={48} height={15} rx={4} fill={c.color} fillOpacity={0.12} />
            <text x={c.cx} y={c.cy + 1} textAnchor="middle" fontSize={7} fill={c.color} fontWeight={600}>
              {c.label}
            </text>
          </g>
        ))}

        {/* Count badges appear with labels */}
        {showLabels && CLUSTERS.map((c, i) => (
          <text key={`count-${i}`} x={c.cx} y={c.cy + 12} textAnchor="middle" fontSize={6}
            fill="currentColor" className="text-muted-foreground"
            style={{ opacity: showLabels ? 0.7 : 0, transition: 'opacity 0.4s ease' }}
          >
            {c.count}
          </text>
        ))}

        {/* Dots animating to cluster centers */}
        {DOTS.map((dot, i) => {
          const target = CLUSTERS[dot.cluster]
          const x = clustered ? target.cx + JITTER[i].x : dot.initialX
          const y = clustered ? target.cy + JITTER[i].y : dot.initialY
          return (
            <circle
              key={i}
              cx={x} cy={y} r={3.5}
              fill={CLUSTERS[dot.cluster].color}
              fillOpacity={clustered ? 0.8 : 0.5}
              style={{
                transition: 'cx 0.95s cubic-bezier(0.4,0,0.2,1), cy 0.95s cubic-bezier(0.4,0,0.2,1), fill-opacity 0.5s ease',
              }}
            />
          )
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-3">
        {CLUSTERS.map(c => (
          <div key={c.label} className="flex items-center gap-1 text-[8px]">
            <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
            <span className="text-muted-foreground">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
