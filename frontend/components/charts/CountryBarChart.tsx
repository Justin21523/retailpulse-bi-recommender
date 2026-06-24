'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import { formatGBP } from '@/lib/utils'
import type { CountryMetric } from '@/types/index'

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as CountryMetric
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-semibold mb-1">{d.country}</p>
      <p>Revenue: <span className="font-medium">{formatGBP(d.revenue)}</span></p>
      <p className="text-muted-foreground">Share: {d.revenue_pct.toFixed(1)}%</p>
      <p className="text-muted-foreground">Orders: {d.orders.toLocaleString()}</p>
    </div>
  )
}

export function CountryBarChart({ data }: { data: CountryMetric[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 10, left: 5, bottom: 5 }}
      >
        <XAxis
          type="number"
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `£${(v / 1000).toFixed(0)}K`}
        />
        <YAxis
          type="category"
          dataKey="country"
          tick={{ fontSize: 11 }}
          width={80}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="revenue" radius={[0, 3, 3, 0]}>
          {data.map((entry, i) => (
            // 英國用品牌主色，其他國家用透明主色
            <Cell
              key={i}
              fill={entry.country === 'United Kingdom'
                ? 'var(--color-primary)'
                : 'color-mix(in oklch, var(--color-primary) 35%, transparent)'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
