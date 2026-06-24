import { Badge } from '@/components/ui/badge'
import { cn, SEGMENT_BADGE_STYLES } from '@/lib/utils'

export function SegmentBadge({ segment }: { segment: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium',
        SEGMENT_BADGE_STYLES[segment] ?? 'bg-muted text-muted-foreground border-border',
      )}
    >
      {segment}
    </Badge>
  )
}
