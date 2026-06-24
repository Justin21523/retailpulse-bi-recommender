'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  ComposedChart,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { KPICard } from '@/components/cards/KPICard'
import {
  useForecast,
  useForecastAll,
  useForecastDecomposition,
  useForecastModels,
} from '@/hooks/useApi'
import { useQueryClient } from '@tanstack/react-query'
import { TrendingUp, AlertCircle, BarChart3, Calendar, Download } from 'lucide-react'
import { exportCSV } from '@/lib/export'
import { DynamicInsight } from '@/components/analysis/DynamicInsight'
import {
  BarChart, Bar, Cell,
  XAxis as BXAxis, YAxis as BYAxis, CartesianGrid as BCG,
  Tooltip as BTooltip, ResponsiveContainer as BRC,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { ForecastPoint, ForecastModelMetric } from '@/types/index'
import { useI18n } from '@/contexts/I18nContext'

type Model = 'sarima' | 'ets' | 'lstm'

const MODEL_META: Record<Model, { label: string; desc: string }> = {
  sarima: { label: 'SARIMA', desc: '統計時序 — 週期性差分 (1,1,1)(0,1,1,7)' },
  ets:    { label: 'ETS',    desc: 'Holt-Winters 指數平滑 — 自動選 additive/multiplicative' },
  lstm:   { label: 'LSTM',   desc: '深度學習序列模型 — 滑動視窗 30 天' },
}

// 格式化日期為 MM/DD
function fmtDate(d: string) {
  const dt = new Date(d)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

function fmtGBP(v: number) {
  return `£${v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
}

function ForecastChart({ data, isLoading }: { data: ForecastPoint[] | undefined; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-72 w-full" />
  if (!data?.length) return (
    <div className="h-72 flex items-center justify-center text-muted-foreground text-sm gap-2">
      <AlertCircle className="w-4 h-4" />
      No forecast data — run <code className="font-mono bg-muted px-1 rounded">make train-ts</code>
    </div>
  )

  const chartData = data.map(p => ({
    date: fmtDate(p.date),
    predicted: Math.round(p.predicted_revenue),
    lower: Math.round(p.lower_ci),
    upper: Math.round(p.upper_ci),
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
          tickLine={false}
          interval={4}
        />
        <YAxis
          tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip
          formatter={(v) => [fmtGBP(Number(v)), 'Revenue']}
          contentStyle={{
            background: 'var(--color-popover)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            fontSize: '12px',
          }}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        {/* 95% CI 帶 */}
        <Area
          dataKey="upper"
          stackId="ci"
          stroke="none"
          fill="color-mix(in oklch, var(--color-primary) 15%, transparent)"
          legendType="none"
          name="Upper CI"
        />
        <Area
          dataKey="lower"
          stackId="ci"
          stroke="none"
          fill="var(--color-background)"
          legendType="none"
          name="Lower CI"
        />
        <Line
          type="monotone"
          dataKey="predicted"
          stroke="var(--color-primary)"
          strokeWidth={2}
          dot={false}
          name="Predicted Revenue"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ── Decomposition mini-chart helper ───────────────────────────────────────────
interface DecompPoint {
  date: string
  observed: number
  trend: number
  seasonal: number
  residual: number
}

function DecompMiniChart({
  data,
  dataKey,
  label,
  color,
}: {
  data: DecompPoint[]
  dataKey: keyof DecompPoint
  label: string
  color: string
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1 font-medium">{label}</p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: 'var(--color-muted-foreground)' }}
            tickLine={false}
            interval={Math.max(1, Math.floor(data.length / 6))}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'var(--color-muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(v) => [fmtGBP(Number(v)), label]}
            contentStyle={{
              background: 'var(--color-popover)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              fontSize: '11px',
            }}
          />
          <Line
            type="monotone"
            dataKey={dataKey as string}
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function ForecastPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [model, setModel] = useState<Model>('sarima')
  const [horizon, setHorizon] = useState(30)

  // Invalidate forecast cache on mount to clear any stale empty state
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['forecast'] })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Existing hooks ──────────────────────────────────────────────────────────
  const { data, isLoading } = useForecast(model, horizon)
  const { sarima: sarimaMeta, ets: etsMeta, lstm: lstmMeta } = useForecastAll(7)

  // ── Multi-model overlay hooks ───────────────────────────────────────────────
  const { data: sarimaAll, isLoading: sarimaLoading } = useForecast('sarima', horizon)
  const { data: etsAll,    isLoading: etsLoading    } = useForecast('ets',    horizon)
  const { data: lstmAll,   isLoading: lstmLoading   } = useForecast('lstm',   horizon)
  const multiLoading = sarimaLoading || etsLoading || lstmLoading

  // ── Decomposition hook ──────────────────────────────────────────────────────
  const { data: decompData, isLoading: decompLoading, error: decompError } = useForecastDecomposition()

  // ── Model metrics hook ──────────────────────────────────────────────────────
  const { data: modelsData, isLoading: modelsLoading } = useForecastModels()

  // ── Derived values (existing) ───────────────────────────────────────────────
  const forecasts = data?.forecasts ?? []
  const peakDay = forecasts.reduce<ForecastPoint | null>((best, p) =>
    !best || p.predicted_revenue > best.predicted_revenue ? p : best, null)
  const weekSum = forecasts.slice(0, 7).reduce((s, p) => s + p.predicted_revenue, 0)

  const mapeCompData = [
    { name: 'SARIMA', mape: sarimaMeta.data?.mape != null ? Number((sarimaMeta.data.mape * 100).toFixed(2)) : null },
    { name: 'ETS',    mape: etsMeta.data?.mape != null    ? Number((etsMeta.data.mape * 100).toFixed(2))    : null },
    { name: 'LSTM',   mape: lstmMeta.data?.mape != null   ? Number((lstmMeta.data.mape * 100).toFixed(2))   : null },
  ].filter((d) => d.mape !== null)

  const bestModel = mapeCompData.length ? mapeCompData.reduce((a, b) => (a.mape! < b.mape! ? a : b)) : null

  const forecastInsight = weekSum > 0 && peakDay
    ? `未來 7 天預測總收入 £${Math.round(weekSum / 1000)}k，峰值出現在 ${fmtDate(peakDay.date)}（${fmtGBP(peakDay.predicted_revenue)}）${bestModel ? `。最低誤差模型：${bestModel.name}（MAPE ${bestModel.mape}%）` : ''}`
    : null

  // ── Multi-model overlay data ────────────────────────────────────────────────
  const multiData = useMemo(() => {
    const sForecasts = sarimaAll?.forecasts
    if (!sForecasts?.length) return []
    return sForecasts.map((p, i) => ({
      date: fmtDate(p.date),
      sarima: Math.round(p.predicted_revenue),
      ets:    Math.round(etsAll?.forecasts[i]?.predicted_revenue ?? 0),
      lstm:   Math.round(lstmAll?.forecasts[i]?.predicted_revenue ?? 0),
      lower:  Math.round(p.lower_ci),
      upper:  Math.round(p.upper_ci),
    }))
  }, [sarimaAll, etsAll, lstmAll])

  // ── Decomposition chart data ────────────────────────────────────────────────
  const decompChartData = useMemo((): DecompPoint[] => {
    if (!decompData?.dates?.length) return []
    const step = Math.max(1, Math.floor(decompData.dates.length / 60))
    return decompData.dates
      .filter((_, i) => i % step === 0)
      .map((date, idx) => ({
        date: date.slice(5), // MM-DD
        observed: Math.round(decompData.observed[idx * step] ?? 0),
        trend:    Math.round(decompData.trend[idx * step]    ?? 0),
        seasonal: Math.round(decompData.seasonal[idx * step] ?? 0),
        residual: Math.round(decompData.residual[idx * step] ?? 0),
      }))
  }, [decompData])

  // ── Best MAPE model from metrics table ─────────────────────────────────────
  const bestMetricModel = useMemo((): ForecastModelMetric | null => {
    if (!modelsData?.length) return null
    return modelsData.reduce<ForecastModelMetric | null>((best, m) => {
      if (m.mape == null) return best
      if (!best || (best.mape ?? Infinity) > m.mape) return m
      return best
    }, null)
  }, [modelsData])

  return (
    <div className="space-y-6 max-w-screen-xl">
      {/* 標題 */}
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('forecast.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('forecast.subtitle')}</p>
      </div>

      {/* 動態解說 */}
      {forecastInsight && <DynamicInsight insight={forecastInsight} variant="success" />}

      {/* KPI strip */}
      <div data-tour="forecast-kpi" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title={t('forecast.kpi.next7')}
          value={isLoading ? '—' : `£${Math.round(weekSum / 1000)}k`}
          subtitle={t('forecast.kpi.next7')}
          icon={Calendar}
          accent="primary"
          loading={isLoading}
        />
        <KPICard
          title={t('forecast.kpi.peakDay')}
          value={isLoading ? '—' : (peakDay ? fmtDate(peakDay.date) : '—')}
          subtitle={peakDay ? fmtGBP(peakDay.predicted_revenue) : ''}
          icon={TrendingUp}
          accent="success"
          loading={isLoading}
        />
        <KPICard
          title={t('forecast.kpi.mape')}
          value={isLoading ? '—' : (data?.mape != null ? `${(data.mape * 100).toFixed(1)}%` : 'N/A')}
          subtitle={t('forecast.kpi.mapeNote')}
          icon={BarChart3}
          accent="accent"
          loading={isLoading}
        />
      </div>

      {/* 模型選擇 + 時距 */}
      <Card data-tour="model-selector">
        <CardHeader>
          <CardTitle className="text-base">{t('forecast.settings.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6">
          {/* 模型切換 */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t('forecast.settings.model')}</p>
            <div className="flex gap-2">
              {(Object.keys(MODEL_META) as Model[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors',
                    model === m
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-muted',
                  )}
                >
                  {MODEL_META[m].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{MODEL_META[model].desc}</p>
          </div>

          {/* 時距切換 */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t('forecast.settings.horizon')}</p>
            <div className="flex gap-2">
              {[7, 14, 30, 60, 90].map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors',
                    horizon === h
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-muted',
                  )}
                >
                  {h}d
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 折線圖 + 95% CI */}
      <Card data-tour="forecast-chart">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-base">
              {MODEL_META[model].label} — Next {horizon} Days Revenue Forecast
              <span className="ml-2 text-xs font-normal text-muted-foreground">(shaded band = 95% CI)</span>
            </CardTitle>
          </div>
          <button
            onClick={() => exportCSV(
              forecasts.map(p => ({ date: p.date, predicted_revenue: p.predicted_revenue, lower_ci: p.lower_ci, upper_ci: p.upper_ci })),
              `forecast-${model}-${horizon}d.csv`
            )}
            disabled={!forecasts.length}
            className="flex items-center gap-1 px-2 py-1 rounded border border-border text-xs text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
        </CardHeader>
        <CardContent>
          <ForecastChart data={forecasts} isLoading={isLoading} />
        </CardContent>
      </Card>

      {/* 三模型 MAPE 比較 */}
      {mapeCompData.length > 0 && (
        <Card data-tour="mape-comparison">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('forecast.comparison.title')}</CardTitle>
            <p className="text-xs text-muted-foreground">MAPE 越低 = 預測越準確</p>
          </CardHeader>
          <CardContent>
            <BRC width="100%" height={140}>
              <BarChart data={mapeCompData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <BCG strokeDasharray="3 3" stroke="var(--color-border)" />
                <BXAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} />
                <BYAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <BTooltip
                  formatter={(v) => [`${v}%`, 'MAPE']}
                  contentStyle={{ fontSize: '12px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                />
                <Bar dataKey="mape" name="MAPE" radius={[4, 4, 0, 0]}>
                  {mapeCompData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.name === bestModel?.name ? 'var(--color-primary)' : 'var(--color-muted-foreground)'}
                      fillOpacity={entry.name === bestModel?.name ? 0.9 : 0.5}
                    />
                  ))}
                </Bar>
              </BarChart>
            </BRC>
          </CardContent>
        </Card>
      )}

      {/* ── 三模型預測比較 ─────────────────────────────────────────────────── */}
      <Card data-tour="multi-model-chart">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">三模型預測比較 — {horizon}天</CardTitle>
          <p className="text-xs text-muted-foreground">綠色=SARIMA · 藍色=ETS · 紫色=LSTM</p>
        </CardHeader>
        <CardContent>
          {multiLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : multiData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-muted-foreground text-sm gap-2">
              <AlertCircle className="w-4 h-4" />
              No multi-model data — run <code className="font-mono bg-muted px-1 rounded">make train-ts</code>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={multiData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  interval={4}
                />
                <YAxis
                  tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <Tooltip
                  formatter={(v, name) => [fmtGBP(Number(v)), String(name).toUpperCase()]}
                  contentStyle={{
                    background: 'var(--color-popover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                {/* 95% CI band — only for selected model (SARIMA data) */}
                {model === 'sarima' && (
                  <>
                    <Area
                      dataKey="upper"
                      stackId="ci"
                      stroke="none"
                      fill="color-mix(in oklch, #22c55e 12%, transparent)"
                      legendType="none"
                      name="Upper CI"
                      isAnimationActive={false}
                    />
                    <Area
                      dataKey="lower"
                      stackId="ci"
                      stroke="none"
                      fill="var(--color-background)"
                      legendType="none"
                      name="Lower CI"
                      isAnimationActive={false}
                    />
                  </>
                )}
                <Line
                  type="monotone"
                  dataKey="sarima"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  name="SARIMA"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="ets"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                  name="ETS"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="lstm"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={false}
                  name="LSTM"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── 時間序列分解 (SARIMA) ──────────────────────────────────────────── */}
      <Card data-tour="decomposition-chart">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">時間序列分解 (SARIMA)</CardTitle>
          <p className="text-xs text-muted-foreground">實際觀測值拆解為趨勢、週期與殘差成份</p>
        </CardHeader>
        <CardContent>
          {decompLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : decompError || !decompChartData.length ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm gap-2">
              <AlertCircle className="w-4 h-4" />
              需要 SARIMA 模型 — run <code className="font-mono bg-muted px-1 rounded">make train-ts</code>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <DecompMiniChart
                data={decompChartData}
                dataKey="observed"
                label="實際 (Observed)"
                color="var(--color-primary)"
              />
              <DecompMiniChart
                data={decompChartData}
                dataKey="trend"
                label="趨勢 (Trend)"
                color="#f59e0b"
              />
              <DecompMiniChart
                data={decompChartData}
                dataKey="seasonal"
                label="週期 (Seasonal)"
                color="#22c55e"
              />
              <DecompMiniChart
                data={decompChartData}
                dataKey="residual"
                label="殘差 (Residual)"
                color="#ef4444"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 模型績效比較表 ────────────────────────────────────────────────── */}
      <Card data-tour="model-metrics">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">模型績效比較</CardTitle>
          <p className="text-xs text-muted-foreground">MAPE / AIC / BIC — 標亮列為最低 MAPE 模型</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {modelsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !modelsData?.length ? (
            <div className="h-20 flex items-center justify-center text-muted-foreground text-sm gap-2">
              <AlertCircle className="w-4 h-4" />
              No model metrics — run <code className="font-mono bg-muted px-1 rounded">make train-ts</code>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2">模型</th>
                  <th className="px-4 py-2 text-right tabular-nums">MAPE</th>
                  <th className="px-4 py-2 text-right tabular-nums">AIC</th>
                  <th className="px-4 py-2 text-right tabular-nums">BIC</th>
                  <th className="px-4 py-2 text-right">訓練時間</th>
                </tr>
              </thead>
              <tbody>
                {modelsData.map((row, i) => {
                  const isBest = bestMetricModel?.model === row.model
                  return (
                    <tr
                      key={i}
                      className={cn(
                        'border-t border-border transition-colors',
                        isBest
                          ? 'bg-primary/10 font-semibold'
                          : 'hover:bg-primary/5',
                      )}
                    >
                      <td className="px-4 py-2 font-medium uppercase">{row.model}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {row.mape != null ? `${(row.mape * 100).toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {row.aic != null ? row.aic.toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {row.bic != null ? row.bic.toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground text-xs">
                        {row.trained_at ? row.trained_at.slice(0, 10) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* 預測明細表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('forecast.detail.title')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2">{t('forecast.detail.date')}</th>
                  <th className="px-4 py-2 text-right tabular-nums">{t('forecast.detail.predicted')}</th>
                  <th className="px-4 py-2 text-right tabular-nums">{t('forecast.detail.lower')}</th>
                  <th className="px-4 py-2 text-right tabular-nums">{t('forecast.detail.upper')}</th>
                </tr>
              </thead>
              <tbody>
                {forecasts.slice(0, 30).map((row, i) => (
                  <tr key={i} className="border-t border-border hover:bg-primary/5 transition-colors">
                    <td className="px-4 py-1.5">{row.date}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums font-medium">{fmtGBP(row.predicted_revenue)}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{fmtGBP(row.lower_ci)}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{fmtGBP(row.upper_ci)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
