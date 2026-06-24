import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── 數字格式化 ──────────────────────────────────────────────────────────────
export function formatGBP(n: number, decimals = 0): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: decimals,
  }).format(n)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-GB').format(n)
}

export function formatPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`
}

// ── 圖表顏色（Recharts 用 hex，無法用 CSS var） ────────────────────────────
export const SEGMENT_COLORS: Record<string, string> = {
  'Champions':       '#16a34a',
  'Loyal Customers': '#3b82f6',  // 與品牌藍系一致
  'At Risk':         '#f59e0b',
  'Lost':            '#ef4444',
}

// ── Segment Badge Tailwind class（語意化，不用固定色） ──────────────────────
export const SEGMENT_BADGE_STYLES: Record<string, string> = {
  'Champions':       'bg-success/10 text-success border-success/25',
  'Loyal Customers': 'bg-primary/10 text-primary border-primary/25',
  'At Risk':         'bg-warning/10 text-warning border-warning/30',
  'Lost':            'bg-destructive/10 text-destructive border-destructive/25',
}

// ── Recommendation 理由 badge ──────────────────────────────────────────────
export const REASON_BADGE_STYLES: Record<string, string> = {
  'FBT':     'bg-primary/10 text-primary border-primary/20',
  'Segment': 'bg-accent/40 text-accent-foreground border-accent/50',
  'Popular': 'bg-muted text-muted-foreground border-border',
}

// ── Lift badge（MBA rules 強度） ────────────────────────────────────────────
export function liftBadgeClass(lift: number, maxLift: number): string {
  const pct = lift / maxLift
  if (pct >= 0.7) return 'bg-success/15 text-success border-success/30'
  if (pct >= 0.35) return 'bg-warning/15 text-warning border-warning/35'
  return 'bg-muted text-muted-foreground border-border'
}

// ── Cohort heatmap：0%=紅(0°) → 100%=綠(120°) ────────────────────────────
export function retentionColor(pct: number): string {
  const clamped = Math.max(0, Math.min(100, pct))
  return `hsl(${Math.round(clamped * 1.2)}, 65%, 42%)`
}
