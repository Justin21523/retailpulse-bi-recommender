'use client'
import { useEffect, useState } from 'react'

const STEPS = [
  { label: '退貨發票（C 前綴）',  removed: 9288,   color: 'text-red-500' },
  { label: '空白 CustomerID',      removed: 135080, color: 'text-orange-500' },
  { label: '無效數量 / 價格',      removed: 2515,   color: 'text-amber-500' },
  { label: '空白 StockCode',       removed: 1102,   color: 'text-yellow-600' },
]

export function CleaningStage({ active }: { active: boolean }) {
  const [step, setStep] = useState(-1)
  const [count, setCount] = useState(541909)
  const [showBadge, setShowBadge] = useState(false)

  useEffect(() => {
    setStep(-1)
    setCount(541909)
    setShowBadge(false)
    if (!active) return

    let s = -1
    const advance = setInterval(() => {
      s++
      if (s >= STEPS.length) { clearInterval(advance); return }
      setStep(s)
      const removed = STEPS[s].removed
      const start = Date.now()
      const duration = 600
      const timer = setInterval(() => {
        const elapsed = Date.now() - start
        const progress = Math.min(elapsed / duration, 1)
        setCount(c => Math.round(c - removed * progress * (1 / 20)))
        if (elapsed >= duration) clearInterval(timer)
      }, 30)
    }, 900)

    const badgeTimer = setTimeout(() => setShowBadge(true), 900 * 4 + 700)
    return () => { clearInterval(advance); clearTimeout(badgeTimer) }
  }, [active])

  const retained = count
  const pct = ((retained / 541909) * 100).toFixed(0)
  const removedCount = 541909 - retained
  const removedPct = (100 - Number(pct)).toFixed(0)

  return (
    <div className="w-full space-y-2">
      {/* Animated counter */}
      <div className="flex items-center justify-between bg-muted/40 rounded px-2 py-1.5">
        <span className="text-xs text-muted-foreground">保留筆數</span>
        <span className="text-base font-bold tabular-nums text-primary">
          {retained.toLocaleString()}
          <span className="text-xs font-normal text-muted-foreground ml-1">({pct}%)</span>
        </span>
      </div>

      {/* Steps with strikethrough-style animation */}
      <div className="space-y-1">
        {STEPS.map((s, i) => (
          <div
            key={i}
            style={{
              opacity: step >= i ? 1 : 0.22,
              transition: 'opacity 0.4s ease',
            }}
            className="flex items-center gap-2 text-[10px]"
          >
            <span
              style={{ transition: 'all 0.3s' }}
              className={`w-3 h-3 rounded-full flex-shrink-0 ${step >= i ? 'bg-red-500' : 'bg-muted'}`}
            />
            <span
              className="flex-1 truncate text-muted-foreground"
              style={{
                textDecoration: step > i ? 'line-through' : 'none',
                textDecorationColor: '#ef4444',
                transition: 'text-decoration 0.5s',
              }}
            >
              {s.label}
            </span>
            <span className={`font-mono ${s.color} font-semibold`}>
              -{s.removed.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {/* Final summary badge */}
      {showBadge && (
        <div
          className="flex items-center justify-between bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded px-2 py-1.5"
          style={{ animation: 'float-in-out 2800ms ease-in-out 0ms both' }}
        >
          <div>
            <div className="text-[10px] font-semibold text-green-700 dark:text-green-400">
              ✓ 397,924 筆乾淨資料
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5">
              移除 {removedCount.toLocaleString()} 筆（{removedPct}%）
            </div>
          </div>
          <span className="text-red-500 text-sm font-bold">-{removedPct}%</span>
        </div>
      )}
    </div>
  )
}
