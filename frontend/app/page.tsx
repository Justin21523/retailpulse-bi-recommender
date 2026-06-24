'use client'

import { Banknote, ShoppingBag, TrendingUp, Users, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { KPICard } from '@/components/cards/KPICard'
import { InsightCard } from '@/components/cards/InsightCard'
import { RevenueLineChart } from '@/components/charts/RevenueLineChart'
import { CountryBarChart } from '@/components/charts/CountryBarChart'
import { PipelineFlow } from '@/components/dashboard/PipelineFlow'
import {
  useMetricsOverview,
  useMonthlyRevenue,
  useCountries,
  useTopProducts,
  useInsights,
  useModelRegistry,
} from '@/hooks/useApi'
import { formatGBP, formatNumber } from '@/lib/utils'
import { useI18n } from '@/contexts/I18nContext'

export default function DashboardPage() {
  const { t } = useI18n()
  const { data: overview, isLoading: loadingKpi }     = useMetricsOverview()
  const { data: monthly,  isLoading: loadingMonthly } = useMonthlyRevenue()
  const { data: countries,isLoading: loadingCountry } = useCountries(10)
  const { data: products, isLoading: loadingProd }    = useTopProducts(10)
  const { data: insights, isLoading: loadingInsights} = useInsights()
  const { data: registry, isLoading: loadingRegistry } = useModelRegistry()

  // 計算月增長率
  const growth = (() => {
    if (!monthly || monthly.length < 2) return null
    const last = monthly[monthly.length - 1]
    const prev = monthly[monthly.length - 2]
    if (!prev.revenue || prev.revenue === 0) return null
    return ((last.revenue - prev.revenue) / prev.revenue) * 100
  })()

  return (
    <div className="space-y-6 max-w-screen-xl">
      {/* 頁首 */}
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* Row 1：KPI Cards */}
      <div data-tour="kpi-strip" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title={t('dashboard.kpi.revenue')}
          value={overview ? formatGBP(overview.total_revenue) : '—'}
          subtitle={growth != null
            ? `${growth >= 0 ? '▲' : '▼'} ${Math.abs(growth).toFixed(1)}% ${t('dashboard.growth.vsLastMonth')}`
            : t('dashboard.kpi.revenueNote')
          }
          icon={Banknote}
          accent="primary"
          loading={loadingKpi}
        />
        <KPICard
          title={t('dashboard.kpi.orders')}
          value={overview ? formatNumber(overview.total_orders) : '—'}
          subtitle={t('dashboard.kpi.ordersNote')}
          icon={ShoppingBag}
          accent="accent"
          loading={loadingKpi}
        />
        <KPICard
          title={t('dashboard.kpi.aov')}
          value={overview ? formatGBP(overview.aov, 2) : '—'}
          subtitle={t('dashboard.kpi.aovNote')}
          icon={TrendingUp}
          accent="success"
          loading={loadingKpi}
        />
        <KPICard
          title={t('dashboard.kpi.customers')}
          value={overview ? formatNumber(overview.active_customers) : '—'}
          subtitle={`${t('dashboard.kpi.customersNote')}${overview?.top_country ? ` · ${overview.top_country}` : ''}`}
          icon={Users}
          accent="warning"
          loading={loadingKpi}
        />
      </div>

      {/* Row 2：Pipeline Flow */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
            {t('dashboard.sections.pipeline')}
          </CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <PipelineFlow />
        </CardContent>
      </Card>

      {/* Row 3：月收入折線圖（全寬） */}
      <Card data-tour="monthly-chart">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('dashboard.sections.monthlyRevenue')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingMonthly ? (
            <Skeleton className="h-64 w-full" />
          ) : monthly?.length ? (
            <RevenueLineChart data={monthly} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-16">
              {t('common.noData')} — {t('common.runEtl')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Row 4：國家（左60%）+ 洞察（右40%） */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card data-tour="country-chart" className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dashboard.sections.topCountries')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCountry ? (
              <Skeleton className="h-64 w-full" />
            ) : countries?.length ? (
              <CountryBarChart data={countries} />
            ) : null}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {t('dashboard.sections.insights')}
          </p>
          {loadingInsights ? (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </>
          ) : (
            insights?.slice(0, 3).map((ins, i) => (
              <InsightCard key={i} insight={ins} />
            ))
          )}
        </div>
      </div>

      {/* Row 5：熱門商品（全寬） */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('dashboard.sections.topProducts')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingProd ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-xs text-muted-foreground">
                  <th className="text-left py-2.5 px-4 w-8">{t('dashboard.table.rank')}</th>
                  <th className="text-left py-2.5 px-2">{t('dashboard.table.description')}</th>
                  <th className="text-right py-2.5 px-4">{t('dashboard.table.revenue')}</th>
                  <th className="text-right py-2.5 px-4">{t('dashboard.table.orders')}</th>
                  <th className="text-right py-2.5 px-4">{t('dashboard.table.avgPrice')}</th>
                </tr>
              </thead>
              <tbody>
                {products?.map((p, i) => (
                  <tr key={p.stock_code} className="border-b last:border-0 hover:bg-primary/5 transition-colors">
                    <td className="py-2.5 px-4 text-muted-foreground font-mono text-xs">{i + 1}</td>
                    <td className="py-2.5 px-2 truncate max-w-[320px]" title={p.description}>
                      {p.description}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold">
                      {formatGBP(p.total_revenue)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">
                      {p.order_count.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">
                      {formatGBP(p.avg_price, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Row 6：ML 模型狀態卡 */}
      <Card data-tour="model-status">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            {t('dashboard.sections.mlStatus')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRegistry ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : registry?.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {registry.map((m) => (
                <div key={m.model_id} className="rounded-lg border border-border bg-primary/3 p-3 space-y-0.5">
                  <p className="text-xs font-semibold truncate">{m.model_name}</p>
                  <p className="text-[10px] text-muted-foreground">{m.model_type}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {Object.entries(m.metrics).slice(0, 2).map(([k, v]) => (
                      <span key={k} className="px-1 py-0.5 rounded bg-primary/10 text-[10px] tabular-nums">
                        {k}: {typeof v === 'number' ? v.toFixed(3) : String(v ?? '—')}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('common.runTrainAll')}</p>
          )}
        </CardContent>
      </Card>

      {/* 底部剩餘洞察 */}
      {!loadingInsights && insights && insights.length > 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {insights.slice(3).map((ins, i) => (
            <InsightCard key={i} insight={ins} />
          ))}
        </div>
      )}
    </div>
  )
}
