'use client'
import { useEffect, useState } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts'

const FULL_DATA = [
  { d: '06/25', s: 1240, e: 1180, l: 1310 },
  { d: '06/26', s: 980,  e: 950,  l: 1020 },
  { d: '06/27', s: 1560, e: 1480, l: 1620 },
  { d: '06/28', s: 1380, e: 1310, l: 1450 },
  { d: '06/29', s: 1720, e: 1650, l: 1800 },
  { d: '06/30', s: 1190, e: 1130, l: 1270 },
  { d: '07/01', s: 2100, e: 2020, l: 2180 },
  { d: '07/02', s: 1840, e: 1760, l: 1910 },
  { d: '07/03', s: 1630, e: 1560, l: 1710 },
  { d: '07/04', s: 1950, e: 1870, l: 2030 },
  { d: '07/05', s: 2240, e: 2160, l: 2320 },
  { d: '07/06', s: 1780, e: 1700, l: 1850 },
]

function MapeCounter({ active }: { active: boolean }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    setVal(0)
    if (!active) return
    const steps = 20
    let i = 0
    const iv = setInterval(() => {
      i++
      setVal(Math.round(37 * (i / steps) * 10) / 10)
      if (i >= steps) clearInterval(iv)
    }, 60)
    return () => clearInterval(iv)
  }, [active])
  return <>{val.toFixed(1)}</>
}

export function ForecastStage({ active }: { active: boolean }) {
  const [shown, setShown] = useState(0)
  const [showMape, setShowMape] = useState(false)

  useEffect(() => {
    setShown(0)
    setShowMape(false)
    if (!active) return
    let i = 0
    const timer = setInterval(() => {
      i++
      setShown(i)
      if (i >= FULL_DATA.length) {
        clearInterval(timer)
        setTimeout(() => setShowMape(true), 300)
      }
    }, 150)
    return () => clearInterval(timer)
  }, [active])

  const data = FULL_DATA.slice(0, Math.max(1, shown))

  return (
    <div className="w-full">
      {/* Legend + MAPE badge */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex gap-3">
          {[
            { label: 'SARIMA', color: '#22c55e' },
            { label: 'ETS',    color: '#3b82f6' },
            { label: 'LSTM',   color: '#a855f7' },
          ].map(m => (
            <div key={m.label} className="flex items-center gap-1 text-[8px]">
              <div className="w-4 h-0.5" style={{ background: m.color }} />
              <span className="text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
        {/* MAPE indicator */}
        <div
          style={{ opacity: showMape ? 1 : 0, transition: 'opacity 0.5s ease' }}
          className="flex items-center gap-1 bg-primary/10 rounded px-1.5 py-0.5"
        >
          <span className="text-[8px] text-muted-foreground">MAPE</span>
          <span className="text-[9px] font-bold text-primary tabular-nums">
            <MapeCounter active={showMape} />%
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={130}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="d" tick={{ fontSize: 8, fill: 'var(--color-muted-foreground)' }} tickLine={false} interval={2} />
          <YAxis tick={{ fontSize: 8, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} width={36}
            tickFormatter={(v) => `£${(v / 1000).toFixed(1)}k`} />
          <Line type="monotone" dataKey="s" stroke="#22c55e" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="e" stroke="#3b82f6" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="l" stroke="#a855f7" strokeWidth={1.5} dot={false} isAnimationActive={false} strokeDasharray="4 2" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
