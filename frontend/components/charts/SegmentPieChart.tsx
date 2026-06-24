'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { SEGMENT_COLORS, formatNumber } from '@/lib/utils'
import type { SegmentSummary } from '@/types/index'

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as SegmentSummary
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">{d.segment}</p>
      <p>{formatNumber(d.count)} customers ({d.revenue_pct.toFixed(1)}% revenue)</p>
    </div>
  )
}

export function SegmentPieChart({ data }: { data: SegmentSummary[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="segment"
          cx="50%"
          cy="45%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell
              key={entry.segment}
              fill={SEGMENT_COLORS[entry.segment] ?? '#94a3b8'}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => <span className="text-xs">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
