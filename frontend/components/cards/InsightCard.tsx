import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { InsightItem } from '@/types/index'

// 依類型設定左側色條（語意色，不用固定 Tailwind 顏色）
const TYPE_ACCENT: Record<string, string> = {
  pareto:     'border-primary',
  peak_month: 'border-accent-foreground',
  champions:  'border-success',
  mba:        'border-warning',
  at_risk:    'border-destructive',
}

const TYPE_ICON_COLOR: Record<string, string> = {
  pareto:     'text-primary',
  peak_month: 'text-accent-foreground',
  champions:  'text-success',
  mba:        'text-warning',
  at_risk:    'text-destructive',
}

export function InsightCard({ insight }: { insight: InsightItem }) {
  const accentBorder = TYPE_ACCENT[insight.type] ?? 'border-muted-foreground'
  const iconColor    = TYPE_ICON_COLOR[insight.type] ?? 'text-muted-foreground'

  return (
    <Card className={cn('border-l-4', accentBorder)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <span className={cn('text-xl shrink-0 mt-0.5', iconColor)}>
            {insight.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">{insight.title}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">
              {insight.description}
            </p>
            <p className="text-lg font-bold mt-2 text-foreground">{insight.value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
