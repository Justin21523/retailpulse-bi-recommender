'use client'

import { Lightbulb, TrendingUp, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'info' | 'warning' | 'success'

interface DynamicInsightProps {
  insight: string
  variant?: Variant
  className?: string
}

const STYLES: Record<Variant, { bg: string; border: string; text: string; icon: typeof Lightbulb }> = {
  info:    { bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-800',   icon: Lightbulb    },
  warning: { bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-800',  icon: AlertTriangle },
  success: { bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-800',  icon: TrendingUp   },
}

export function DynamicInsight({ insight, variant = 'info', className }: DynamicInsightProps) {
  const { bg, border, text, icon: Icon } = STYLES[variant]
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border px-4 py-3', bg, border, className)}>
      <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', text)} />
      <p className={cn('text-sm leading-relaxed', text)}>{insight}</p>
    </div>
  )
}
