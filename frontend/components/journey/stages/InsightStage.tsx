'use client'
import { useEffect, useState } from 'react'

function CountUp({ target, prefix = '', suffix = '', delay = 0, active }: {
  target: number; prefix?: string; suffix?: string; delay?: number; active: boolean
}) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    setVal(0)
    if (!active) return
    const t = setTimeout(() => {
      const steps = 30
      let i = 0
      const interval = setInterval(() => {
        i++
        setVal(Math.round(target * (i / steps)))
        if (i >= steps) clearInterval(interval)
      }, 25)
      return () => clearInterval(interval)
    }, delay)
    return () => clearTimeout(t)
  }, [active, target, delay])
  return <>{prefix}{val.toLocaleString()}{suffix}</>
}

const KPIS = [
  { label: '總營收',    target: 8911407, prefix: '£', suffix: '',  color: 'text-green-600',  delay: 0 },
  { label: '活躍客戶', target: 4338,     prefix: '',  suffix: '',  color: 'text-blue-600',   delay: 200 },
  { label: '訓練模型', target: 11,       prefix: '',  suffix: '+', color: 'text-purple-600', delay: 400 },
  { label: '關聯規則', target: 88,       prefix: '',  suffix: '',  color: 'text-amber-600',  delay: 600 },
]

// Star burst particles (8 directions, staggered 0-7)
const STAR_DIRS = [1, 2, 3, 4, 5, 6, 7, 8]

export function InsightStage({ active }: { active: boolean }) {
  const [showStars, setShowStars] = useState(false)

  useEffect(() => {
    setShowStars(false)
    if (!active) return
    const t = setTimeout(() => setShowStars(true), 800)
    return () => clearTimeout(t)
  }, [active])

  return (
    <div className="w-full relative">
      <div className="grid grid-cols-2 gap-2 pt-1">
        {KPIS.map((kpi, idx) => (
          <div
            key={kpi.label}
            style={{
              opacity: active ? 1 : 0,
              transform: active ? 'scale(1) rotateX(0deg)' : 'scale(0.85) rotateX(20deg)',
              transformStyle: 'preserve-3d',
              perspective: '600px',
              transition: `opacity 0.4s ease ${kpi.delay}ms, transform 0.5s cubic-bezier(0.34,1.56,0.64,1) ${kpi.delay}ms`,
            }}
            className="bg-muted/40 rounded-lg px-2 py-2 text-center"
          >
            <div className={`text-base font-black tabular-nums ${kpi.color}`}>
              <CountUp
                target={kpi.target}
                prefix={kpi.prefix}
                suffix={kpi.suffix}
                delay={kpi.delay}
                active={active}
              />
            </div>
            <div className="text-[8px] text-muted-foreground mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Star burst particles centered over the grid */}
      {showStars && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {STAR_DIRS.map((n) => (
            <span
              key={n}
              className="absolute text-amber-400 text-[9px] font-bold"
              style={{
                animation: `star-burst-${n} 0.65s ease 50ms both`,
              }}
            >
              ✦
            </span>
          ))}
        </div>
      )}

      {/* Pipeline complete badge */}
      <div
        style={{ opacity: showStars ? 1 : 0, transition: 'opacity 0.6s ease 0.4s' }}
        className="mt-2 text-center text-[9px] text-amber-600 font-semibold"
      >
        ✦ Pipeline 完整 · 11 個 API 端點就緒 ✦
      </div>
    </div>
  )
}
