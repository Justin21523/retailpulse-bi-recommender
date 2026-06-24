'use client'

import { cn } from '@/lib/utils'

type ColorKey = 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'yellow'

const COLOR_STYLES: Record<ColorKey, { bg: string; border: string; badge: string; dot: string }> = {
  blue:   { bg: 'bg-blue-50   dark:bg-blue-950/30',   border: 'border-blue-200   dark:border-blue-800',   badge: 'bg-blue-100   text-blue-700',   dot: 'bg-blue-500'   },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  green:  { bg: 'bg-green-50  dark:bg-green-950/30',  border: 'border-green-200  dark:border-green-800',  badge: 'bg-green-100  text-green-700',  dot: 'bg-green-500'  },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  red:    { bg: 'bg-red-50    dark:bg-red-950/30',    border: 'border-red-200    dark:border-red-800',    badge: 'bg-red-100    text-red-700',    dot: 'bg-red-500'    },
  yellow: { bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-800', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
}

export interface MLParadigmCardProps {
  paradigm:    string       // e.g. "監督式學習"
  color:       ColorKey
  model:       string       // e.g. "CLV Regressor + Churn Classifier"
  algorithm:   string       // e.g. "3-layer MLP"
  metric:      string       // e.g. "R²=0.875 / AUC=1.0"
  description: string
  tech:        string[]     // chips e.g. ["PyTorch", "RFM Features"]
}

export function MLParadigmCard({
  paradigm, color, model, algorithm, metric, description, tech,
}: MLParadigmCardProps) {
  const s = COLOR_STYLES[color]

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', s.bg, s.border)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={cn('w-2.5 h-2.5 rounded-full', s.dot)} />
        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', s.badge)}>
          {paradigm}
        </span>
      </div>

      {/* Model name */}
      <div>
        <p className="font-semibold text-sm">{model}</p>
        <p className="text-xs text-muted-foreground">{algorithm}</p>
      </div>

      {/* Metric badge */}
      <div className={cn('inline-flex px-2 py-0.5 rounded text-xs font-mono font-medium', s.badge)}>
        {metric}
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>

      {/* Tech chips */}
      <div className="flex flex-wrap gap-1">
        {tech.map((t) => (
          <span key={t} className="px-1.5 py-0.5 rounded bg-background/70 border text-[10px] font-medium">
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}
