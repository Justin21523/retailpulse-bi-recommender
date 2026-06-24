'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface PipelineStep {
  icon: string
  label: string
  tech: string
  detail: string
  color: string   // Tailwind bg class for the circle
  textColor: string
}

const STEPS: PipelineStep[] = [
  {
    icon: '📦',
    label: 'Raw Data',
    tech: 'UCI Online Retail',
    detail: '541,909 transactions from UCI ML Repository (2010–2011). Excel → DuckDB ingestion via pandas.',
    color: 'bg-muted',
    textColor: 'text-foreground',
  },
  {
    icon: '🔧',
    label: 'ETL & Clean',
    tech: 'DuckDB · Pandas',
    detail: 'Remove cancelled orders, null CustomerID, qty ≤ 0. 397,884 rows after cleaning. Stored in 8 DuckDB tables.',
    color: 'bg-primary/15',
    textColor: 'text-primary',
  },
  {
    icon: '📊',
    label: 'Feature Eng.',
    tech: 'RFM · Cohort',
    detail: 'Compute Recency/Frequency/Monetary per customer. Monthly cohort matrix (13×13). Daily revenue aggregation.',
    color: 'bg-accent/40',
    textColor: 'text-accent-foreground',
  },
  {
    icon: '🤖',
    label: 'ML / Mining',
    tech: 'K-Means · Apriori',
    detail: 'K-Means clustering → 4 RFM segments. mlxtend Apriori → 88 association rules (max lift=24.03).',
    color: 'bg-success/15',
    textColor: 'text-success',
  },
  {
    icon: '⚡',
    label: 'API Layer',
    tech: 'FastAPI · Pydantic',
    detail: '15 REST endpoints serving analytics data. 3-tier recommender: FBT → Segment → Popularity fallback.',
    color: 'bg-warning/15',
    textColor: 'text-warning',
  },
  {
    icon: '📈',
    label: 'Dashboard',
    tech: 'Next.js · Recharts',
    detail: '5 interactive pages. TanStack Query for data fetching. Recharts + custom SVG components.',
    color: 'bg-primary/20',
    textColor: 'text-primary',
  },
]

export function PipelineFlow() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-start min-w-[640px] px-2 py-4">
        {STEPS.map((step, i) => (
          <div key={i} className="flex items-start flex-1">
            {/* 節點 */}
            <div
              className="flex flex-col items-center cursor-default select-none flex-1"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* 圓形圖示 */}
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center text-xl',
                  'border-2 border-border transition-transform duration-150',
                  step.color,
                  hoveredIdx === i && 'scale-110 shadow-md',
                )}
              >
                {step.icon}
              </div>

              {/* 標籤 */}
              <div className="mt-2 text-center">
                <p className={cn('text-xs font-semibold', step.textColor)}>{step.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                  {step.tech}
                </p>
              </div>

              {/* Hover tooltip */}
              {hoveredIdx === i && (
                <div
                  className="absolute mt-20 z-20 w-52 rounded-lg border bg-popover p-3 text-xs shadow-lg"
                  style={{ marginTop: '4.5rem' }}
                >
                  <p className="font-semibold text-foreground mb-1">{step.label}</p>
                  <p className="text-muted-foreground leading-snug">{step.detail}</p>
                </div>
              )}
            </div>

            {/* 箭頭連線（最後一個節點不需要） */}
            {i < STEPS.length - 1 && (
              <div className="flex items-center pt-4 flex-shrink-0 w-8">
                <div className="flex-1 h-px bg-border" />
                <svg className="text-muted-foreground shrink-0" width="8" height="8" viewBox="0 0 8 8">
                  <path d="M0 4 L6 0 L6 8 Z" fill="currentColor" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
