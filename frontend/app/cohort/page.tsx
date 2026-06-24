'use client'

import { useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { KPICard } from '@/components/cards/KPICard'
import { CohortHeatmap } from '@/components/charts/CohortHeatmap'
import { DynamicInsight } from '@/components/analysis/DynamicInsight'
import { useCohortMatrix } from '@/hooks/useApi'
import { useI18n } from '@/contexts/I18nContext'
import { retentionColor } from '@/lib/utils'
import { Users, TrendingUp, Calendar, Download } from 'lucide-react'
import { exportCSV } from '@/lib/export'

export default function CohortPage() {
  const { t } = useI18n()
  const { data, isLoading } = useCohortMatrix()

  const stats = useMemo(() => {
    if (!data) return null
    const { matrix, cohort_months } = data
    const month1Retentions = matrix
      .map((row) => row[1])
      .filter((v): v is number => v !== null && v !== undefined)

    const avgM1 =
      month1Retentions.length > 0
        ? month1Retentions.reduce((a, b) => a + b, 0) / month1Retentions.length
        : 0

    let bestCohort = ''
    let bestPct = 0
    month1Retentions.forEach((pct, i) => {
      if (pct > bestPct) {
        bestPct = pct
        bestCohort = cohort_months[i]
      }
    })

    return {
      total: cohort_months.length,
      avgM1: avgM1.toFixed(1),
      bestCohort,
      bestPct: bestPct.toFixed(1),
    }
  }, [data])

  // M1 留存趨勢資料（每個同期群組的 Month 1 留存率）
  const trendData = useMemo(() => {
    if (!data) return []
    const { matrix, cohort_months } = data
    return cohort_months.map((month, i) => ({
      month: month.slice(0, 7), // YYYY-MM
      retention: matrix[i]?.[1] != null ? Number((matrix[i][1]!).toFixed(1)) : null,
    })).filter((d) => d.retention !== null)
  }, [data])

  // 各月平均留存率（跨所有同期群的欄平均）
  const avgRetentionData = useMemo(() => {
    if (!data) return []
    return data.periods.map((period, pi) => {
      const vals = data.matrix.map(row => row[pi]).filter((v): v is number => v !== null)
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      return { period, avg: Math.round(avg * 10) / 10 }
    })
  }, [data])

  // 動態解說
  const insightText = stats
    ? t('cohort.insight')
        .replace('{{avg}}', stats.avgM1)
        .replace('{{month}}', stats.bestCohort)
        .replace('{{best}}', stats.bestPct)
    : null

  return (
    <div className="space-y-6 max-w-screen-xl">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('cohort.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('cohort.subtitle')}</p>
      </div>

      {/* 動態解說 */}
      {insightText && <DynamicInsight insight={insightText} variant="info" />}

      {/* KPI 卡片 */}
      <div data-tour="cohort-kpi" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title={t('cohort.kpi.total')}
          value={stats ? stats.total : '—'}
          subtitle={t('cohort.kpi.totalNote')}
          icon={Calendar}
          accent="primary"
          loading={isLoading}
        />
        <KPICard
          title={t('cohort.kpi.avgM1')}
          value={stats ? `${stats.avgM1}%` : '—'}
          subtitle={t('cohort.kpi.avgM1Note')}
          icon={TrendingUp}
          accent="success"
          loading={isLoading}
        />
        <KPICard
          title={t('cohort.kpi.bestCohort')}
          value={stats ? `${stats.bestCohort} (${stats.bestPct}%)` : '—'}
          subtitle={t('cohort.kpi.bestCohortNote')}
          icon={Users}
          accent="warning"
          loading={isLoading}
        />
      </div>

      {/* M1 留存趨勢折線圖 */}
      <Card data-tour="m1-trend">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('cohort.trend.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-52 w-full" />
          ) : trendData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  interval={Math.floor(trendData.length / 8)}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  formatter={(v) => [`${v}%`, 'M1 Retention']}
                  contentStyle={{
                    background: 'var(--color-popover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="retention"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--color-primary)' }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : null}
        </CardContent>
      </Card>

      {/* 各月平均留存率 */}
      <Card data-tour="avg-retention-bar">
        <CardHeader className="pb-2 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-base">各月平均留存率</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              跨所有同期群的欄均值 — Month 0 = 100%（定義），後續月份顯示實際留存衰減趨勢
            </p>
          </div>
          <button
            onClick={() => exportCSV(avgRetentionData.map(d => ({ period: d.period, avg_retention_pct: d.avg })), 'cohort-retention.csv')}
            disabled={!avgRetentionData.length}
            className="flex items-center gap-1 px-2 py-1 rounded border border-border text-xs text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : avgRetentionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={avgRetentionData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  domain={[0, 100]}
                />
                <Tooltip
                  formatter={(v) => [`${v}%`, '平均留存率']}
                  contentStyle={{
                    background: 'var(--color-popover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                  {avgRetentionData.map((d, i) => (
                    <Cell key={i} fill={retentionColor(d.avg)} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </CardContent>
      </Card>

      {/* 留存熱力圖 */}
      <Card data-tour="cohort-heatmap">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('cohort.heatmap')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('cohort.hint')}</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : data ? (
            <CohortHeatmap data={data} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-16">
              {t('cohort.noData')} — {t('common.runEtl')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
