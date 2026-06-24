'use client'

import { useState, useMemo } from 'react'
import {
  ScatterChart, Scatter, BarChart, Bar, Cell,
  XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { KPICard } from '@/components/cards/KPICard'
import { DynamicInsight } from '@/components/analysis/DynamicInsight'
import { useBasketRules, useBasketSummary } from '@/hooks/useApi'
import { useI18n } from '@/contexts/I18nContext'
import { ShoppingCart, Zap, TrendingUp } from 'lucide-react'
import { liftBadgeClass } from '@/lib/utils'
import type { MBARule } from '@/types/index'

// Lift 散點圖：x=support, y=confidence, z=lift（點大小）
function LiftScatterChart({ rules, maxLift }: { rules: MBARule[]; maxLift: number }) {
  const data = rules.slice(0, 200).map((r) => ({
    x: Number((r.support * 100).toFixed(3)),
    y: Number((r.confidence * 100).toFixed(1)),
    z: Number(r.lift.toFixed(2)),
    ant: r.antecedent_description ?? r.antecedents,
    con: r.consequent_description ?? r.consequents,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="x"
          type="number"
          name="Support"
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
          tickLine={false}
          label={{ value: 'Support (%)', position: 'insideBottom', offset: -4, fontSize: 11, fill: 'var(--color-muted-foreground)' }}
        />
        <YAxis
          dataKey="y"
          type="number"
          name="Confidence"
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          width={44}
          label={{ value: 'Confidence (%)', angle: -90, position: 'insideLeft', offset: 8, fontSize: 11, fill: 'var(--color-muted-foreground)' }}
        />
        <ZAxis dataKey="z" range={[40, 400]} name="Lift" />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0]?.payload as typeof data[0]
            return (
              <div className="bg-popover border border-border rounded-md p-2 text-xs shadow-md max-w-[200px]">
                <p className="font-medium truncate">{d.ant}</p>
                <p className="text-muted-foreground truncate">→ {d.con}</p>
                <p className="mt-1">Support: <strong>{d.x}%</strong></p>
                <p>Confidence: <strong>{d.y}%</strong></p>
                <p>Lift: <strong className="text-primary">{d.z}</strong></p>
              </div>
            )
          }}
        />
        <Scatter
          data={data}
          fill="var(--color-primary)"
          fillOpacity={0.6}
        />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// Top 10 規則橫條圖（依 Lift）
function TopRulesChart({ rules }: { rules: MBARule[] }) {
  const top10 = [...rules]
    .sort((a, b) => b.lift - a.lift)
    .slice(0, 10)
    .map((r) => ({
      label: `${(r.antecedent_description ?? r.antecedents).slice(0, 20)} → ${(r.consequent_description ?? r.consequents).slice(0, 18)}`,
      lift: Number(r.lift.toFixed(2)),
      conf: Number((r.confidence * 100).toFixed(0)),
    }))
    .reverse()

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={top10} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={200}
          tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
          tickLine={false}
        />
        <Tooltip
          formatter={(v, name) => [name === 'lift' ? `${v}` : `${v}%`, name === 'lift' ? 'Lift' : 'Confidence']}
          contentStyle={{ fontSize: '12px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
        />
        <Bar dataKey="lift" name="lift" radius={[0, 4, 4, 0]}>
          {top10.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.lift > 5 ? 'var(--color-destructive)' : entry.lift > 3 ? '#f59e0b' : 'var(--color-primary)'}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function BasketPage() {
  const { t } = useI18n()
  const [minLift, setMinLift] = useState(1.0)
  const [minConf, setMinConf] = useState(0.1)
  const [textFilter, setTextFilter] = useState('')

  const { data: rules, isLoading: loadingRules } = useBasketRules({
    min_lift: 1.0,
    limit: 300,
  })
  const { data: summary, isLoading: loadingSummary } = useBasketSummary()

  const filtered = useMemo<MBARule[]>(() => {
    if (!rules) return []
    return rules.filter((r) => {
      if (r.lift < minLift) return false
      if (r.confidence < minConf) return false
      if (textFilter) {
        const q = textFilter.toLowerCase()
        const ant = (r.antecedent_description ?? r.antecedents).toLowerCase()
        const con = (r.consequent_description ?? r.consequents).toLowerCase()
        if (!ant.includes(q) && !con.includes(q)) return false
      }
      return true
    })
  }, [rules, minLift, minConf, textFilter])

  const maxLift = summary?.max_lift ?? 25

  // 動態解說：最強規則
  const insightText = useMemo(() => {
    if (!rules?.length) return null
    const top = [...rules].sort((a, b) => b.lift - a.lift)[0]
    return t('basket.insight')
      .replace('{{ant}}', (top.antecedent_description ?? top.antecedents).slice(0, 30))
      .replace('{{con}}', (top.consequent_description ?? top.consequents).slice(0, 30))
      .replace('{{lift}}', top.lift.toFixed(2))
      .replace('{{conf}}', (top.confidence * 100).toFixed(0))
  }, [rules, t])

  return (
    <div className="space-y-6 max-w-screen-xl">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('basket.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('basket.subtitle')} · {summary?.total_rules ?? '—'} {t('basket.summary.totalRules')}
        </p>
      </div>

      {/* 動態解說 */}
      {insightText && <DynamicInsight insight={insightText} variant="success" />}

      {/* KPI */}
      <div data-tour="basket-kpi" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title={t('basket.summary.totalRules')}
          value={summary?.total_rules ?? '—'}
          icon={ShoppingCart}
          accent="primary"
          loading={loadingSummary}
        />
        <KPICard
          title={t('basket.summary.maxLift')}
          value={summary ? summary.max_lift.toFixed(2) : '—'}
          subtitle={t('basket.summary.avgLift') + ': ' + (summary ? summary.avg_lift?.toFixed(2) ?? '—' : '—')}
          icon={Zap}
          accent="success"
          loading={loadingSummary}
        />
        <KPICard
          title={t('basket.summary.avgConfidence')}
          value={summary ? `${(summary.avg_confidence * 100).toFixed(1)}%` : '—'}
          icon={TrendingUp}
          accent="accent"
          loading={loadingSummary}
        />
      </div>

      {/* 圖表區塊 */}
      {!loadingRules && rules && rules.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Lift 散點圖 */}
          <Card data-tour="basket-scatter">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('basket.liftScatter.title')}</CardTitle>
              <p className="text-xs text-muted-foreground">點大小 = Lift 強度</p>
            </CardHeader>
            <CardContent>
              <LiftScatterChart rules={filtered.length ? filtered : rules} maxLift={maxLift} />
            </CardContent>
          </Card>

          {/* Top 10 規則橫條圖 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('basket.topRulesChart.title')}</CardTitle>
              <p className="text-xs text-muted-foreground">紅色 = Lift &gt; 5，橘色 = Lift &gt; 3</p>
            </CardHeader>
            <CardContent>
              {loadingRules ? (
                <Skeleton className="h-72 w-full" />
              ) : (
                <TopRulesChart rules={filtered.length ? filtered : rules} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 篩選控制 */}
      <Card data-tour="basket-filters">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('basket.filters.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t('basket.filters.minLift')}: {minLift.toFixed(1)}
              </label>
              <Slider
                min={1}
                max={Math.ceil(maxLift)}
                step={0.5}
                value={[minLift]}
                onValueChange={(v) => setMinLift(v[0])}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t('basket.filters.minConfidence')}: {(minConf * 100).toFixed(0)}%
              </label>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[minConf]}
                onValueChange={(v) => setMinConf(v[0])}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t('basket.filters.productSearch')}
              </label>
              <Input
                placeholder={t('basket.filters.searchPlaceholder')}
                value={textFilter}
                onChange={(e) => setTextFilter(e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('basket.showing')
              .replace('{{n}}', String(filtered.length))
              .replace('{{total}}', String(rules?.length ?? 0))}
          </p>
        </CardContent>
      </Card>

      {/* 規則表 */}
      <Card data-tour="basket-table">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('basket.table.title')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingRules ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="text-left py-2.5 px-4">{t('basket.table.antecedents')}</th>
                    <th className="text-left py-2.5 px-4">{t('basket.table.consequents')}</th>
                    <th className="text-right py-2.5 px-4">{t('basket.table.support')}</th>
                    <th className="text-right py-2.5 px-4">{t('basket.table.confidence')}</th>
                    <th className="text-right py-2.5 px-4">{t('basket.table.lift')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-primary/5 transition-colors">
                      <td className="py-2 px-4 max-w-[220px] truncate" title={r.antecedents}>
                        {r.antecedent_description ?? r.antecedents}
                      </td>
                      <td className="py-2 px-4 max-w-[220px] truncate" title={r.consequents}>
                        {r.consequent_description ?? r.consequents}
                      </td>
                      <td className="py-2 px-4 text-right text-muted-foreground">
                        {(r.support * 100).toFixed(2)}%
                      </td>
                      <td className="py-2 px-4 text-right text-muted-foreground">
                        {(r.confidence * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 px-4 text-right">
                        <Badge variant="outline" className={`text-xs font-mono ${liftBadgeClass(r.lift, maxLift)}`}>
                          {r.lift.toFixed(2)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-3 border-t">
                  {t('basket.table.more').replace('{{n}}', String(filtered.length))}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
