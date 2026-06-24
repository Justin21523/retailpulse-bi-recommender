'use client'

import { useState, useMemo } from 'react'
import { retentionColor } from '@/lib/utils'
import type { CohortMatrix } from '@/types/index'

interface TooltipState {
  cohort: string
  period: string
  pct: number
  active: number
  size: number
  x: number
  y: number
}

const NULL_CELL_BG = 'repeating-linear-gradient(-45deg, #f1f5f9 0px, #f1f5f9 2px, #f8fafc 2px, #f8fafc 8px)'

export function CohortHeatmap({ data }: { data: CohortMatrix }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const { cohort_months, cohort_sizes, periods, matrix } = data

  const maxSize = useMemo(
    () => Math.max(...cohort_sizes.filter((v): v is number => v != null && v > 0)),
    [cohort_sizes]
  )

  const colAvgs = useMemo(
    () =>
      periods.map((_, ci) => {
        const vals = matrix.map(row => row[ci]).filter((v): v is number => v !== null)
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      }),
    [periods, matrix]
  )

  return (
    <div className="overflow-x-auto relative">
      <table className="text-xs border-separate border-spacing-[2px]">
        <thead>
          <tr>
            <th className="text-left px-2 py-1 text-muted-foreground font-normal min-w-[80px]">
              Cohort
            </th>
            <th className="text-right px-2 py-1 text-muted-foreground font-normal min-w-[64px]">
              Size
            </th>
            {periods.map((p) => (
              <th key={p} className="text-center px-1 py-1 text-muted-foreground font-normal min-w-[48px]">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohort_months.map((month, ri) => {
            const size = cohort_sizes[ri] ?? 0
            const barWidth = maxSize > 0 ? Math.round((size / maxSize) * 100) : 0
            return (
              <tr key={month}>
                <td className="px-2 py-1 text-muted-foreground">{month}</td>
                <td className="px-2 py-1 text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-muted-foreground tabular-nums">{size.toLocaleString()}</span>
                    <div className="h-[3px] rounded-full bg-blue-200 w-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-400"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                </td>
                {periods.map((period, ci) => {
                  const val = matrix[ri]?.[ci]
                  if (val === null || val === undefined) {
                    return (
                      <td
                        key={period}
                        className="rounded"
                        style={{ background: NULL_CELL_BG, minWidth: 48 }}
                      >
                        &nbsp;
                      </td>
                    )
                  }
                  const pct = Math.round(val)
                  return (
                    <td
                      key={period}
                      className="text-center rounded cursor-default font-medium px-1 py-1"
                      style={{
                        background: retentionColor(pct),
                        color: pct > 30 ? '#fff' : '#1e293b',
                        minWidth: 48,
                      }}
                      onMouseEnter={(e) => {
                        const rect = (e.target as HTMLElement).getBoundingClientRect()
                        setTooltip({
                          cohort: month,
                          period,
                          pct,
                          active: Math.round((val / 100) * size),
                          size,
                          x: rect.left + rect.width / 2,
                          y: rect.top - 8,
                        })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {pct}%
                    </td>
                  )
                })}
              </tr>
            )
          })}

          {/* 平均值列 */}
          <tr className="border-t-2 border-border">
            <td className="px-2 py-1 font-bold text-foreground">平均</td>
            <td className="px-2 py-1 text-right text-muted-foreground">—</td>
            {colAvgs.map((avg, ci) => {
              if (avg === null) {
                return (
                  <td
                    key={ci}
                    className="rounded"
                    style={{ background: NULL_CELL_BG, minWidth: 48 }}
                  >
                    &nbsp;
                  </td>
                )
              }
              const pct = Math.round(avg)
              return (
                <td
                  key={ci}
                  className="text-center rounded font-bold px-1 py-1"
                  style={{
                    background: retentionColor(pct),
                    color: pct > 30 ? '#fff' : '#1e293b',
                    minWidth: 48,
                    opacity: 0.92,
                  }}
                >
                  {pct}%
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>

      {/* Tooltip（fixed position） */}
      {tooltip && (
        <div
          className="fixed z-50 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translateX(-50%) translateY(-100%)' }}
        >
          <p className="font-semibold">{tooltip.cohort} · {tooltip.period}</p>
          <p>Retention: <strong>{tooltip.pct}%</strong></p>
          <p className="text-muted-foreground">
            {tooltip.active} / {tooltip.size} customers
          </p>
        </div>
      )}
    </div>
  )
}
