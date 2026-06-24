'use client'
import { useEffect, useState } from 'react'

const ROWS = [
  { inv: '536365', code: '85123A', desc: 'CREAM HANGING HEART', qty: 6, price: '£2.55', cust: '17850' },
  { inv: '536366', code: '22633',  desc: 'HAND WARMER UNION JACK', qty: 6, price: '£1.85', cust: '17850' },
  { inv: '536367', code: '84879',  desc: 'ASSORTED COLOUR BIRD', qty: 32, price: '£1.69', cust: '13047' },
  { inv: '536368', code: '22960',  desc: 'JAM MAKING SET', qty: 6, price: '£4.25', cust: '12583' },
  { inv: '536369', code: '21756',  desc: 'BATH BUILDING BLOCK', qty: 3, price: '£5.95', cust: '13748' },
]

const RAIN_POSITIONS = [8, 24, 42, 60, 80]

function TotalCounter({ active }: { active: boolean }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    setVal(0)
    if (!active) return
    const steps = 24
    let i = 0
    const iv = setInterval(() => {
      i++
      setVal(Math.round(541909 * (i / steps)))
      if (i >= steps) clearInterval(iv)
    }, 33)
    return () => clearInterval(iv)
  }, [active])
  return <>{val.toLocaleString()}</>
}

export function RawDataStage({ active }: { active: boolean }) {
  const [shown, setShown] = useState(0)
  const [showTotal, setShowTotal] = useState(false)

  useEffect(() => {
    setShown(0)
    setShowTotal(false)
    if (!active) return
    let i = 0
    const timer = setInterval(() => {
      i++
      setShown(i)
      if (i >= ROWS.length) {
        clearInterval(timer)
        setTimeout(() => setShowTotal(true), 200)
      }
    }, 220)
    return () => clearInterval(timer)
  }, [active])

  return (
    <div className="w-full overflow-hidden text-[9px] font-mono relative">
      {/* Background data-rain particles */}
      {active && RAIN_POSITIONS.map((left, i) => (
        <span
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary/15 pointer-events-none"
          style={{
            left: `${left}%`,
            top: 0,
            animation: `data-rain ${1.4 + i * 0.25}s linear ${i * 0.35}s infinite`,
          }}
        />
      ))}

      {/* Header row */}
      <div className="grid grid-cols-6 gap-0.5 bg-muted/60 px-1 py-0.5 rounded-t text-[8px] font-semibold text-muted-foreground uppercase tracking-wide">
        <span>#</span><span>Code</span><span className="col-span-2">Description</span><span>Qty</span><span>Price</span>
      </div>

      {/* Data rows with staggered reveal + row-number flash */}
      {ROWS.map((r, i) => (
        <div
          key={i}
          style={{
            opacity: shown > i ? 1 : 0,
            transform: shown > i ? 'translateY(0)' : 'translateY(-4px)',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
          }}
          className="grid grid-cols-6 gap-0.5 px-1 py-0.5 border-b border-border/40 hover:bg-primary/5"
        >
          <span
            className="text-primary/70"
            style={{
              animation: shown === i + 1 ? 'none' : undefined,
              color: shown === i + 1 ? 'var(--color-primary)' : undefined,
            }}
          >
            {String(i + 1).padStart(3, '0')}
          </span>
          <span className="text-muted-foreground truncate">{r.code}</span>
          <span className="col-span-2 truncate">{r.desc}</span>
          <span>{r.qty}</span>
          <span className="text-green-600">{r.price}</span>
        </div>
      ))}

      {/* "More rows" indicator */}
      {active && shown >= ROWS.length && !showTotal && (
        <div className="text-center text-[8px] text-muted-foreground py-1 animate-pulse">
          ... 載入中 ...
        </div>
      )}

      {/* Total counter */}
      {showTotal && (
        <div className="flex items-center justify-center gap-2 mt-1 py-1 bg-primary/8 rounded text-[9px]"
          style={{ animation: 'float-in-out 2800ms ease-in-out 0ms both' }}
        >
          <span className="text-muted-foreground">TOTAL</span>
          <span className="font-bold text-primary tabular-nums">
            <TotalCounter active={showTotal} />
          </span>
          <span className="text-muted-foreground">rows</span>
        </div>
      )}
    </div>
  )
}
