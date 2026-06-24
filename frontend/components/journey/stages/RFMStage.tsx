'use client'
import { useEffect, useState } from 'react'

const CUSTOMER = { id: 'C-17850', recency: 19, frequency: 7, monetary: 4310 }

function Counter({ target, active, delay = 0 }: { target: number; active: boolean; delay?: number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    setVal(0)
    if (!active) return
    const timer = setTimeout(() => {
      const steps = 30
      let i = 0
      const interval = setInterval(() => {
        i++
        setVal(Math.round(target * (i / steps)))
        if (i >= steps) clearInterval(interval)
      }, 25)
      return () => clearInterval(interval)
    }, delay)
    return () => clearTimeout(timer)
  }, [active, target, delay])
  return <>{val.toLocaleString()}</>
}

// SVG arc gauge driven by CSS transition on stroke-dashoffset
function ArcGauge({ score, color, delay, active }: { score: number; color: string; delay: number; active: boolean }) {
  const [filled, setFilled] = useState(false)
  const r = 13
  const circumference = 2 * Math.PI * r // ≈ 81.7

  useEffect(() => {
    setFilled(false)
    if (!active) return
    const t = setTimeout(() => setFilled(true), delay + 200)
    return () => clearTimeout(t)
  }, [active, delay])

  const fillPct = filled ? score / 5 : 0
  const offset = circumference * (1 - fillPct)

  return (
    <svg width={34} height={34} viewBox="0 0 34 34" className="shrink-0">
      {/* Track */}
      <circle cx={17} cy={17} r={r} fill="none" stroke="currentColor" strokeWidth={3}
        className="text-muted/50" />
      {/* Fill arc */}
      <circle
        cx={17} cy={17} r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transformOrigin: '17px 17px',
          transform: 'rotate(-90deg)',
          transition: `stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)`,
        }}
      />
      {/* Score label */}
      <text x={17} y={21} textAnchor="middle" fontSize={9} fontWeight={700} fill={color}>
        {score}
      </text>
    </svg>
  )
}

export function RFMStage({ active }: { active: boolean }) {
  const [showScore, setShowScore] = useState(false)

  useEffect(() => {
    setShowScore(false)
    if (!active) return
    const t = setTimeout(() => setShowScore(true), 1400)
    return () => clearTimeout(t)
  }, [active])

  const metrics = [
    { label: 'R（近期性）', value: CUSTOMER.recency, unit: '天',  desc: '最後購買距今', color: '#3b82f6', score: 4, delay: 0 },
    { label: 'F（購買頻率）', value: CUSTOMER.frequency, unit: '次', desc: '不同發票數',  color: '#22c55e', score: 4, delay: 400 },
    { label: 'M（消費金額）', value: CUSTOMER.monetary, unit: '',  desc: '累計消費',    color: '#a855f7', score: 4, delay: 800 },
  ]

  return (
    <div className="w-full space-y-1.5">
      <div className="text-[9px] text-muted-foreground text-center">客戶 {CUSTOMER.id}</div>

      {/* RFM rows with arc gauge */}
      {metrics.map((row) => (
        <div key={row.label} className="flex items-center gap-2 bg-muted/30 rounded px-2 py-1.5">
          <ArcGauge score={row.score} color={row.color} delay={row.delay} active={active} />
          <div className="w-24 text-[9px] text-muted-foreground shrink-0">
            <div className="font-semibold text-foreground text-[10px]">{row.label}</div>
            <div>{row.desc}</div>
          </div>
          <div className="flex-1 text-right text-sm font-bold tabular-nums" style={{ color: row.color }}>
            {row.unit === '' ? '£' : ''}
            <Counter target={row.value} active={active} delay={row.delay} />
            {row.unit && <span className="text-xs font-normal ml-0.5">{row.unit}</span>}
          </div>
        </div>
      ))}

      {/* RFM Score badge */}
      <div
        style={{
          opacity: showScore ? 1 : 0,
          transform: showScore ? 'scale(1)' : 'scale(0.85)',
          transition: 'all 0.45s cubic-bezier(0.34,1.56,0.64,1)',
        }}
        className="flex items-center justify-center gap-2 bg-primary/10 rounded px-2 py-1.5"
      >
        <span className="text-[9px] text-muted-foreground">RFM 分數</span>
        <span className="text-lg font-black text-primary">4-4-4</span>
        <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">Champions ★</span>
      </div>
    </div>
  )
}
