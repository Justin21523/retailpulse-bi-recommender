'use client'
import { useEffect, useState } from 'react'

const COHORT_DATA = [
  [100, 22, 18, 15, 12, 9],
  [100, 25, 19, 16, 11, 8],
  [100, 21, 17, 13, 10, 7],
  [100, 24, 20, 14, 11, 9],
  [100, 23, 16, 12,  9, 6],
]
const COHORT_LABELS = ['2010-01', '2010-02', '2010-03', '2010-04', '2010-05']
const MONTH_LABELS  = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5']
const TOTAL_CELLS = 5 * 6

function cellColor(pct: number): string {
  if (pct >= 90) return 'bg-green-500 text-white'
  if (pct >= 20) return 'bg-green-300/70 text-green-900 dark:bg-green-700/50 dark:text-green-100'
  if (pct >= 15) return 'bg-amber-200/70 text-amber-900 dark:bg-amber-700/40 dark:text-amber-100'
  if (pct >= 10) return 'bg-amber-100/80 text-amber-800 dark:bg-amber-800/30 dark:text-amber-200'
  return 'bg-muted/30 text-muted-foreground'
}

export function CohortStage({ active }: { active: boolean }) {
  const [shownCells, setShownCells] = useState(0)
  const [showBadges, setShowBadges] = useState(false)

  useEffect(() => {
    setShownCells(0)
    setShowBadges(false)
    if (!active) return
    let i = 0
    const iv = setInterval(() => {
      i++
      setShownCells(i)
      if (i >= TOTAL_CELLS) {
        clearInterval(iv)
        setTimeout(() => setShowBadges(true), 300)
      }
    }, 40)
    return () => clearInterval(iv)
  }, [active])

  return (
    <div className="w-full space-y-1.5">
      {/* Month column headers */}
      <div className="flex gap-1 pl-[54px]">
        {MONTH_LABELS.map(m => (
          <div key={m} className="w-[28px] text-[8px] text-center text-muted-foreground font-medium shrink-0">{m}</div>
        ))}
      </div>

      {/* Heatmap rows */}
      {COHORT_DATA.map((row, ri) => (
        <div key={ri} className="flex items-center gap-1">
          <span className="text-[7px] text-muted-foreground w-[52px] shrink-0 truncate">{COHORT_LABELS[ri]}</span>
          {row.map((pct, ci) => {
            const idx = ri * 6 + ci
            const visible = shownCells > idx
            return (
              <div
                key={ci}
                className={`w-[28px] h-[24px] rounded text-[8px] font-bold flex items-center justify-center shrink-0 transition-all duration-200 ${cellColor(pct)}`}
                style={{ opacity: visible ? 1 : 0, transform: visible ? 'scale(1)' : 'scale(0.7)' }}
              >
                {visible ? (pct === 100 ? '–' : `${pct}%`) : ''}
              </div>
            )
          })}
        </div>
      ))}

      {/* Summary badges */}
      <div
        className="flex justify-center gap-3 pt-1"
        style={{ opacity: showBadges ? 1 : 0, transition: 'opacity 0.5s ease' }}
      >
        <div className="flex items-center gap-1 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-md px-2 py-0.5">
          <span className="text-[8px] text-muted-foreground">M1 avg</span>
          <span className="text-[11px] font-black text-green-700 dark:text-green-400">23%</span>
        </div>
        <div className="flex items-center gap-1 bg-muted/30 border border-border rounded-md px-2 py-0.5">
          <span className="text-[8px] text-muted-foreground">M5 avg</span>
          <span className="text-[11px] font-black text-muted-foreground">8%</span>
        </div>
        <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-md px-2 py-0.5">
          <span className="text-[8px] text-muted-foreground">衰減</span>
          <span className="text-[11px] font-black text-amber-600">-65%</span>
        </div>
      </div>
    </div>
  )
}
