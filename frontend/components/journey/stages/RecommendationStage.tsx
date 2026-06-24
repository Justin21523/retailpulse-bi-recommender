'use client'
import { useEffect, useState } from 'react'

const RECS = [
  { name: 'REGENCY CAKESTAND 3 TIER', algo: 'CF',     score: 94, color: '#6366f1' },
  { name: 'RABBIT DOORSTOP',           algo: 'ALS',    score: 87, color: '#3b82f6' },
  { name: 'VINTAGE FLOWER TINS SET',   algo: 'Bandit', score: 81, color: '#f59e0b' },
]

function ScoreBar({ target, active, color }: { target: number; active: boolean; color: string }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    setWidth(0)
    if (!active) return
    const t = setTimeout(() => setWidth(target), 100)
    return () => clearTimeout(t)
  }, [active, target])
  return (
    <div className="h-1 bg-muted rounded-full overflow-hidden flex-1">
      <div
        className="h-full rounded-full"
        style={{ width: `${width}%`, background: color, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </div>
  )
}

function ConvCounter({ active }: { active: boolean }) {
  const [val, setVal] = useState(5.0)
  useEffect(() => {
    setVal(5.0)
    if (!active) return
    const steps = 20
    let i = 0
    const iv = setInterval(() => {
      i++
      setVal(5.0 + (8.0 - 5.0) * (i / steps))
      if (i >= steps) clearInterval(iv)
    }, 60)
    return () => clearInterval(iv)
  }, [active])
  return <>{val.toFixed(1)}</>
}

export function RecommendationStage({ active }: { active: boolean }) {
  const [shownCards, setShownCards] = useState(0)
  const [showConv, setShowConv] = useState(false)

  useEffect(() => {
    setShownCards(0)
    setShowConv(false)
    if (!active) return
    let i = 0
    const iv = setInterval(() => {
      i++
      setShownCards(i)
      if (i >= RECS.length) {
        clearInterval(iv)
        setTimeout(() => setShowConv(true), 400)
      }
    }, 280)
    return () => clearInterval(iv)
  }, [active])

  return (
    <div className="w-full space-y-2">
      {RECS.map((rec, i) => {
        const visible = shownCards > i
        return (
          <div
            key={i}
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateX(0)' : 'translateX(40px)',
              transition: 'opacity 0.4s ease, transform 0.5s cubic-bezier(0.4,0,0.2,1)',
            }}
            className="bg-muted/30 rounded-lg px-2.5 py-2 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold text-foreground truncate pr-2 leading-tight">{rec.name}</span>
              <span
                className="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                style={{ background: `${rec.color}20`, color: rec.color }}
              >
                {rec.algo}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ScoreBar target={rec.score} active={visible} color={rec.color} />
              <span className="text-[9px] font-black tabular-nums shrink-0" style={{ color: rec.color }}>
                {rec.score}%
              </span>
            </div>
          </div>
        )
      })}

      {/* Conversion rate badge */}
      <div
        style={{ opacity: showConv ? 1 : 0, transition: 'opacity 0.5s ease' }}
        className="flex items-center justify-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-1.5"
      >
        <span className="text-[9px] text-muted-foreground">轉換率</span>
        <span className="text-[10px] font-black text-muted-foreground">5.0%</span>
        <span className="text-[10px] text-green-600">→</span>
        <span className="text-sm font-black text-green-600">
          <ConvCounter active={showConv} />%
        </span>
        <span className="text-[10px] font-bold text-green-500">↑ +60%</span>
      </div>
    </div>
  )
}
