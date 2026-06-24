'use client'
import { useEffect, useState } from 'react'

const NODES = [
  { id: 0, x: 135, y: 28,  label: 'GIFT' },
  { id: 1, x: 192, y: 62,  label: 'CUP' },
  { id: 2, x: 192, y: 128, label: 'PLATE' },
  { id: 3, x: 135, y: 162, label: 'BOX' },
  { id: 4, x: 78,  y: 128, label: 'TRAY' },
  { id: 5, x: 78,  y: 62,  label: 'SET' },
]

const EDGES = [
  { from: 5, to: 1, lift: 3.2 },
  { from: 0, to: 4, lift: 2.8 },
  { from: 1, to: 2, lift: 2.1 },
  { from: 3, to: 4, lift: 1.8 },
  { from: 0, to: 1, lift: 1.5 },
  { from: 5, to: 3, lift: 1.4 },
]

const MAX_LIFT = 3.2

export function BasketStage({ active }: { active: boolean }) {
  const [shownNodes, setShownNodes] = useState(0)
  const [shownEdges, setShownEdges] = useState(0)
  const [pulse, setPulse] = useState(false)
  const [showBadge, setShowBadge] = useState(false)

  useEffect(() => {
    setShownNodes(0)
    setShownEdges(0)
    setPulse(false)
    setShowBadge(false)
    if (!active) return

    let ni = 0
    const nodeIv = setInterval(() => {
      ni++
      setShownNodes(ni)
      if (ni >= NODES.length) clearInterval(nodeIv)
    }, 80)

    const edgeDelay = setTimeout(() => {
      let ei = 0
      const edgeIv = setInterval(() => {
        ei++
        setShownEdges(ei)
        if (ei >= EDGES.length) {
          clearInterval(edgeIv)
          setTimeout(() => { setPulse(true); setShowBadge(true) }, 200)
        }
      }, 130)
      return () => clearInterval(edgeIv)
    }, 500)

    return () => {
      clearInterval(nodeIv)
      clearTimeout(edgeDelay)
    }
  }, [active])

  return (
    <div className="w-full">
      <svg width="100%" height="185" viewBox="0 0 270 190">
        {/* Edges */}
        {EDGES.map((e, i) => {
          const from = NODES[e.from]
          const to   = NODES[e.to]
          const isTop = e.lift === MAX_LIFT
          const visible = shownEdges > i
          return (
            <line
              key={i}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={pulse && isTop ? '#f59e0b' : '#6366f1'}
              strokeWidth={visible ? (e.lift / MAX_LIFT) * 3.5 : 0}
              strokeOpacity={visible ? 0.6 : 0}
              style={{ transition: 'stroke-opacity 0.3s ease, stroke 0.4s ease, stroke-width 0.3s ease' }}
            />
          )
        })}

        {/* Nodes */}
        {NODES.map((n, i) => (
          <g key={n.id} style={{ opacity: shownNodes > i ? 1 : 0, transition: 'opacity 0.3s ease' }}>
            <circle cx={n.x} cy={n.y} r={15} fill="#6366f1" fillOpacity={0.12} stroke="#6366f1" strokeWidth={1.5} />
            <text x={n.x} y={n.y + 3} textAnchor="middle" fontSize={7} fill="#6366f1" fontWeight={700}>
              {n.label}
            </text>
          </g>
        ))}

        {/* Lift badge on strongest edge */}
        <g style={{ opacity: showBadge ? 1 : 0, transition: 'opacity 0.4s ease' }}>
          <rect x={92} y={84} width={86} height={20} rx={5} fill="#f59e0b" fillOpacity={0.15} stroke="#f59e0b" strokeWidth={1} />
          <text x={135} y={98} textAnchor="middle" fontSize={8} fill="#d97706" fontWeight={700}>
            lift=3.2 · conf=70%
          </text>
        </g>
      </svg>
    </div>
  )
}
