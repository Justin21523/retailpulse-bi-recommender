'use client'
import { useEffect, useState } from 'react'

const TARGET_CONTROL   = 5
const TARGET_TREATMENT = 8

// p-value counter from 1.00 down to 0.032
function PValueCounter({ active }: { active: boolean }) {
  const [val, setVal] = useState(1.0)
  useEffect(() => {
    setVal(1.0)
    if (!active) return
    const steps = 30
    let i = 0
    const iv = setInterval(() => {
      i++
      setVal(1.0 - (1.0 - 0.032) * (i / steps))
      if (i >= steps) clearInterval(iv)
    }, 35)
    return () => clearInterval(iv)
  }, [active])
  return <>{val.toFixed(3)}</>
}

export function ABStage({ active }: { active: boolean }) {
  const [control, setControl]       = useState(0)
  const [treatment, setTreatment]   = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [showPValue, setShowPValue] = useState(false)

  useEffect(() => {
    setControl(0)
    setTreatment(0)
    setShowResult(false)
    setShowPValue(false)
    if (!active) return

    const duration = 1200
    const start = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      setControl(TARGET_CONTROL * progress)
      setTreatment(TARGET_TREATMENT * progress)
      if (progress >= 1) {
        clearInterval(timer)
        setTimeout(() => { setShowResult(true); setShowPValue(true) }, 300)
      }
    }, 30)
    return () => clearInterval(timer)
  }, [active])

  const maxPct = 12
  const bars = [
    { label: 'Control A',   value: control,   target: TARGET_CONTROL,   color: '#3b82f6', bg: '#dbeafe' },
    { label: 'Treatment B', value: treatment, target: TARGET_TREATMENT, color: '#22c55e', bg: '#dcfce7' },
  ]

  return (
    <div className="w-full space-y-2 pt-1">
      {bars.map(b => (
        <div key={b.label}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] font-semibold text-muted-foreground">{b.label}</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: b.color }}>
              {b.value.toFixed(1)}%
            </span>
          </div>
          <div className="h-5 rounded-md overflow-hidden" style={{ background: b.bg }}>
            <div
              className="h-full rounded-md"
              style={{
                width: `${(b.value / maxPct) * 100}%`,
                background: b.color,
                transition: 'width 0.05s linear',
              }}
            />
          </div>
          <div className="text-[8px] text-muted-foreground mt-0.5">
            模擬 100 用戶 · {Math.round(b.value)} 次轉換
          </div>
        </div>
      ))}

      {/* p-value countdown */}
      <div
        style={{ opacity: showPValue ? 1 : 0, transition: 'opacity 0.4s ease' }}
        className="flex items-center justify-between bg-muted/30 rounded px-2 py-1 text-[9px]"
      >
        <span className="text-muted-foreground">p-value 倒計</span>
        <span
          className="font-mono font-bold tabular-nums"
          style={{ color: showResult ? '#22c55e' : '#f59e0b' }}
        >
          <PValueCounter active={showPValue} />
        </span>
        <span className="text-muted-foreground">臨界值 0.05</span>
      </div>

      {/* Significance result */}
      <div
        style={{ opacity: showResult ? 1 : 0, transition: 'opacity 0.5s ease' }}
        className="flex items-center justify-between bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded px-2 py-1.5"
      >
        <div>
          <div className="text-[10px] font-semibold text-green-700 dark:text-green-400">統計顯著 ✓</div>
          <div className="text-[8px] text-green-600 dark:text-green-500">p = 0.032 &lt; 0.05 · lift +60%</div>
        </div>
        <div className="text-green-500 text-lg font-bold">↑60%</div>
      </div>
    </div>
  )
}
