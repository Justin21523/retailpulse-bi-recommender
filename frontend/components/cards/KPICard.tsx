import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// 每種 accent 對應的圖示容器配色
const ACCENT_STYLES: Record<string, { bg: string; icon: string }> = {
  primary:     { bg: 'bg-primary/10',     icon: 'text-primary'     },
  success:     { bg: 'bg-success/10',     icon: 'text-success'     },
  warning:     { bg: 'bg-warning/10',     icon: 'text-warning'     },
  accent:      { bg: 'bg-accent/30',      icon: 'text-accent-foreground' },
  destructive: { bg: 'bg-destructive/10', icon: 'text-destructive' },
}

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  accent?: keyof typeof ACCENT_STYLES
  loading?: boolean
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = 'primary',
  loading = false,
}: KPICardProps) {
  const style = ACCENT_STYLES[accent]

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest truncate">
              {title}
            </p>
            {loading ? (
              <Skeleton className="h-9 w-28 mt-2" />
            ) : (
              <p className="text-3xl font-bold mt-1.5 truncate text-foreground">
                {value}
              </p>
            )}
            {subtitle && !loading && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
            )}
          </div>
          {Icon && (
            <div className={cn('p-2.5 rounded-xl shrink-0', style.bg)}>
              <Icon className={cn('h-5 w-5', style.icon)} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
