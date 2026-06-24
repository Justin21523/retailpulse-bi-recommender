'use client'
import { useEffect, useState, useRef } from 'react'

const LAYERS = [
  { nodes: [30, 55, 80, 105, 130], x: 30,  label: '6 特徵' },
  { nodes: [25, 50, 80, 110, 135], x: 100, label: '64 神經元' },
  { nodes: [40, 80, 120],          x: 170, label: '32 神經元' },
  { nodes: [80],                   x: 230, label: '輸出' },
]

const EDGES: { x1: number; y1: number; x2: number; y2: number; layer: number }[] = []
for (let l = 0; l < LAYERS.length - 1; l++) {
  const from = LAYERS[l]
  const to   = LAYERS[l + 1]
  from.nodes.forEach(y1 => {
    to.nodes.slice(0, 3).forEach(y2 => {
      EDGES.push({ x1: from.x, y1, x2: to.x, y2, layer: l })
    })
  })
}

// Typewriter text renderer
function TypewriterText({ text, active }: { text: string; active: boolean }) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    setDisplayed('')
    if (!active) return
    let i = 0
    const iv = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(iv)
    }, 40)
    return () => clearInterval(iv)
  }, [active, text])
  return <>{displayed}</>
}

export function ChurnStage({ active }: { active: boolean }) {
  const [activeLayer, setActiveLayer] = useState(-1)
  const [pulseLayer, setPulseLayer] = useState(-1)
  const [prob, setProb] = useState<number | null>(null)
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setActiveLayer(-1)
    setPulseLayer(-1)
    setProb(null)
    if (!active) return
    let l = -1
    const advance = setInterval(() => {
      l++
      setActiveLayer(l)
      setPulseLayer(l)
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
      pulseTimerRef.current = setTimeout(() => setPulseLayer(-1), 280)
      if (l >= LAYERS.length - 1) {
        clearInterval(advance)
        setTimeout(() => setProb(0.78), 300)
      }
    }, 500)
    return () => {
      clearInterval(advance)
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
    }
  }, [active])

  // Gradient probability bar color
  const probPct = prob !== null ? prob * 100 : 0
  const barColor = probPct >= 70 ? '#ef4444' : probPct >= 40 ? '#f59e0b' : '#22c55e'

  return (
    <div className="w-full">
      <svg width="100%" height="155" viewBox="0 0 270 155">
        {/* Edges */}
        {EDGES.map((e, i) => (
          <line
            key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke={
              pulseLayer === e.layer ? '#93c5fd' :
              activeLayer >= e.layer ? '#3b82f6' : '#e2e8f0'
            }
            strokeWidth={activeLayer >= e.layer ? 0.9 : 0.6}
            strokeOpacity={activeLayer >= e.layer ? 0.55 : 0.25}
            style={{ transition: 'stroke 0.25s ease, stroke-width 0.25s ease' }}
          />
        ))}
        {/* Nodes */}
        {LAYERS.map((layer, li) =>
          layer.nodes.map((y, ni) => (
            <circle
              key={`${li}-${ni}`}
              cx={layer.x} cy={y} r={li === LAYERS.length - 1 ? 7 : 5}
              fill={
                pulseLayer === li ? '#93c5fd' :
                activeLayer >= li ? '#3b82f6' : '#e2e8f0'
              }
              stroke={activeLayer >= li ? '#2563eb' : '#cbd5e1'}
              strokeWidth={1}
              style={{ transition: 'fill 0.25s ease, stroke 0.25s ease' }}
            />
          ))
        )}
        {/* Layer labels */}
        {LAYERS.map((layer, li) => (
          <text key={li} x={layer.x} y={150} textAnchor="middle" fontSize={7}
            fill="var(--color-muted-foreground)">
            {layer.label}
          </text>
        ))}
      </svg>

      {/* Output probability with gradient bar */}
      <div
        style={{ opacity: prob !== null ? 1 : 0, transition: 'opacity 0.5s ease' }}
        className="mt-1 space-y-1"
      >
        <div className="flex items-center justify-center gap-2">
          <span className="text-[9px] text-muted-foreground">流失機率</span>
          <span className="text-xl font-black" style={{ color: barColor }}>
            {prob !== null ? `${(prob * 100).toFixed(0)}%` : ''}
          </span>
          <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">High Risk</span>
        </div>
        {/* Gradient probability bar */}
        <div className="mx-4 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${probPct}%`, background: `linear-gradient(90deg, #22c55e, #f59e0b, ${barColor})` }}
          />
        </div>
        {/* Typewriter message */}
        <p className="text-center text-[9px] text-muted-foreground overflow-hidden whitespace-nowrap"
          style={{ animation: 'typewriter-reveal 1s ease 0.3s both' }}
        >
          <TypewriterText text="預測：此客戶將在 180 天內流失" active={prob !== null} />
        </p>
      </div>
    </div>
  )
}
