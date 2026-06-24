'use client'

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatGBP, SEGMENT_COLORS } from '@/lib/utils'
import type { RFMScatterPoint } from '@/types/index'

// 把全量資料按 segment 分組，供 4 個 Scatter 各自繪製
function groupBySegment(data: RFMScatterPoint[]) {
  const groups: Record<string, RFMScatterPoint[]> = {}
  for (const d of data) {
    if (!groups[d.segment]) groups[d.segment] = []
    groups[d.segment].push(d)
  }
  return groups
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as RFMScatterPoint
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">Customer {d.customer_id}</p>
      <p className="text-muted-foreground">{d.segment} · {d.rfm_score}</p>
      <p>Recency: {d.recency_days}d</p>
      <p>Frequency: {d.frequency} orders</p>
      <p>Monetary: {formatGBP(d.monetary)}</p>
    </div>
  )
}

interface Props {
  data: RFMScatterPoint[]
  activeSegments?: Set<string>
}

export function RFMScatterChart({ data, activeSegments }: Props) {
  const groups = groupBySegment(data)
  const segments = Object.keys(SEGMENT_COLORS)

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          type="number"
          dataKey="recency_days"
          name="Recency (days)"
          tick={{ fontSize: 11 }}
          label={{ value: 'Recency (days)', position: 'insideBottom', offset: -2, fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="frequency"
          name="Frequency"
          tick={{ fontSize: 11 }}
          label={{ value: 'Frequency', angle: -90, position: 'insideLeft', fontSize: 11 }}
        />
        {/* Z 軸控制泡泡大小，對應 monetary */}
        <ZAxis type="number" dataKey="monetary" range={[20, 200]} name="Monetary" />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        {segments.map((seg) => {
          const segData = groups[seg] ?? []
          const hidden = activeSegments && !activeSegments.has(seg)
          if (hidden || !segData.length) return null
          return (
            <Scatter
              key={seg}
              name={seg}
              data={segData}
              fill={SEGMENT_COLORS[seg]}
              fillOpacity={0.65}
            />
          )
        })}
      </ScatterChart>
    </ResponsiveContainer>
  )
}
