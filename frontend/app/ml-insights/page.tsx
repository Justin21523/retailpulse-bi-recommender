'use client'

import { useState, useMemo } from 'react'
import {
  BarChart, Bar, Cell,
  LineChart, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { KPICard } from '@/components/cards/KPICard'
import { DynamicInsight } from '@/components/analysis/DynamicInsight'
import {
  useChurnRisk, useAnomalies, useModelRegistry,
  useChurnModelComparison, useFeatureImportance,
  useChurnROC, useAllChurnRisk, useCLVRanking,
  useCustomerPurchaseHistory,
} from '@/hooks/useApi'
import { useI18n } from '@/contexts/I18nContext'
import { Brain, AlertTriangle, Zap, GitCompare, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { exportCSV } from '@/lib/export'
import type { CustomerCLVItem, ModelComparisonItem } from '@/types/index'

const RISK_BADGE: Record<string, string> = {
  Low:      'bg-green-50  text-green-700  border-green-200',
  Medium:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  High:     'bg-orange-50 text-orange-700 border-orange-200',
  Critical: 'bg-red-50    text-red-700    border-red-200',
}

const MODEL_COLORS: Record<string, string> = {
  'Decision Tree':       '#6366f1',
  'Random Forest':       '#22c55e',
  'Gradient Boosting':   '#f59e0b',
  'MLP Neural Network':  '#3b82f6',
}

// ── ROC Curve ─────────────────────────────────────────────────────────────────
function ROCCurveChart({ threshold }: { threshold: number }) {
  const { data: rocData, isLoading } = useChurnROC()

  const auc = useMemo(() => {
    if (!rocData?.length) return null
    let area = 0
    const sorted = [...rocData].sort((a, b) => a.fpr - b.fpr)
    for (let i = 1; i < sorted.length; i++) {
      const dx = sorted[i].fpr - sorted[i - 1].fpr
      area += dx * (sorted[i].tpr + sorted[i - 1].tpr) / 2
    }
    return area
  }, [rocData])

  if (isLoading) return <Skeleton className="h-56 w-full" />
  if (!rocData?.length) return <p className="text-sm text-muted-foreground">需要 Churn 模型</p>

  const chartData = rocData.map(p => ({ fpr: p.fpr, tpr: p.tpr, threshold: p.threshold }))
  const diagonal = [{ fpr: 0, ref: 0 }, { fpr: 1, ref: 1 }]

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs text-muted-foreground">AUC-ROC:</span>
        <span className="text-sm font-bold text-primary">{auc != null ? auc.toFixed(4) : '—'}</span>
        {auc != null && auc > 0.9 && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">優秀</span>}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart margin={{ top: 4, right: 16, bottom: 16, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="fpr" type="number" domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)}
            label={{ value: 'False Positive Rate', position: 'insideBottom', offset: -10, fontSize: 10, fill: 'var(--color-muted-foreground)' }}
            tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} tickLine={false} />
          <YAxis type="number" domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)}
            label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft', offset: 12, fontSize: 10, fill: 'var(--color-muted-foreground)' }}
            tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v) => [v != null ? Number(v).toFixed(4) : '—']}
            contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
          />
          {/* Random classifier diagonal */}
          <Line data={diagonal} dataKey="ref" stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 4" dot={false} isAnimationActive={false} name="隨機" />
          {/* ROC curve */}
          <Line data={chartData} dataKey="tpr" stroke="var(--color-primary)" strokeWidth={2} dot={false} isAnimationActive={false} name="ROC 曲線" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Confusion Matrix ───────────────────────────────────────────────────────────
function ConfusionMatrix({ threshold }: { threshold: number }) {
  const { data: rocData } = useChurnROC()

  const cm = useMemo(() => {
    if (!rocData?.length) return null
    const point = rocData.reduce((prev, curr) =>
      Math.abs(curr.threshold - threshold) < Math.abs(prev.threshold - threshold) ? curr : prev)
    return point
  }, [rocData, threshold])

  if (!cm) return null

  const cells = [
    { label: 'TP', value: cm.tp, color: 'bg-green-100 text-green-800', desc: '正確預測流失' },
    { label: 'FP', value: cm.fp, color: 'bg-red-100 text-red-800', desc: '誤報（實際未流失）' },
    { label: 'FN', value: cm.fn, color: 'bg-orange-100 text-orange-800', desc: '漏報（實際有流失）' },
    { label: 'TN', value: cm.tn, color: 'bg-blue-100 text-blue-800', desc: '正確預測未流失' },
  ]

  const precision = cm.tp + cm.fp > 0 ? (cm.tp / (cm.tp + cm.fp)) : 0
  const recall    = cm.tp + cm.fn > 0 ? (cm.tp / (cm.tp + cm.fn)) : 0
  const f1        = precision + recall > 0 ? (2 * precision * recall / (precision + recall)) : 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {cells.map(c => (
          <div key={c.label} className={`rounded-lg p-2.5 ${c.color}`}>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-bold">{c.label}</span>
              <span className="text-base font-black tabular-nums">{c.value}</span>
            </div>
            <p className="text-[9px] opacity-80 mt-0.5">{c.desc}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Precision', value: precision },
          { label: 'Recall', value: recall },
          { label: 'F1 Score', value: f1 },
        ].map(m => (
          <div key={m.label} className="bg-muted/40 rounded p-1.5">
            <div className="text-xs font-bold">{(m.value * 100).toFixed(1)}%</div>
            <div className="text-[9px] text-muted-foreground">{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Churn Probability Distribution ────────────────────────────────────────────
function ChurnDistChart() {
  const { data: allChurn, isLoading } = useAllChurnRisk()

  const histData = useMemo(() => {
    if (!allChurn?.length) return []
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}–${(i + 1) * 10}%`,
      count: 0,
      threshold: (i + 1) * 0.1,
    }))
    allChurn.forEach(c => {
      const idx = Math.min(Math.floor(c.churn_probability * 10), 9)
      buckets[idx].count++
    })
    return buckets
  }, [allChurn])

  if (isLoading) return <Skeleton className="h-36 w-full" />
  if (!histData.length) return null

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={histData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="range" tick={{ fontSize: 9, fill: 'var(--color-muted-foreground)' }} tickLine={false} interval={1} />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
        <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid var(--color-border)' }} />
        <Bar dataKey="count" name="客戶數" radius={[3, 3, 0, 0]}>
          {histData.map((d, i) => (
            <Cell key={i} fill={d.threshold <= 0.3 ? '#22c55e' : d.threshold <= 0.6 ? '#f59e0b' : d.threshold <= 0.8 ? '#f97316' : '#ef4444'} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

const FEATURE_LABELS: Record<string, string> = {
  recency_days: '最近購買天數',
  frequency: '購買頻率',
  monetary: '消費金額',
  r_score: 'R 分數',
  f_score: 'F 分數',
  m_score: 'M 分數',
}

// ── 流失預測 Tab ──────────────────────────────────────────────────────────────
function ChurnTab() {
  const { t } = useI18n()
  const [churnThreshold, setChurnThreshold] = useState(0.5)
  const { data: churnData, isLoading: churnLoading } = useChurnRisk(churnThreshold, 50)
  const { data: featureImportance, isLoading: impLoading } = useFeatureImportance()

  const criticalCount = (churnData ?? []).filter((c) => c.risk_level === 'Critical').length
  const highCount     = (churnData ?? []).filter((c) => c.risk_level === 'High').length

  const insightText = churnData?.length
    ? t('mlInsights.churnInsight').replace('{{critical}}', String(criticalCount)).replace('{{high}}', String(highCount))
    : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <KPICard title={t('mlInsights.kpi.critical')} value={churnLoading ? '—' : criticalCount}
          subtitle={t('mlInsights.kpi.criticalNote')} icon={AlertTriangle} accent="destructive" loading={churnLoading} />
        <KPICard title={t('mlInsights.kpi.highRisk')} value={churnLoading ? '—' : highCount}
          subtitle={t('mlInsights.kpi.highRiskNote')} icon={Brain} accent="warning" loading={churnLoading} />
        <KPICard title={t('mlInsights.kpi.modelsTrained')} value="MLP" subtitle="BCEWithLogitsLoss · Adam"
          icon={Zap} accent="primary" loading={false} />
      </div>
      {insightText && <DynamicInsight insight={insightText} variant="warning" />}

      {/* ROC + Confusion Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-tour="roc-curve">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ROC 曲線</CardTitle>
            <p className="text-xs text-muted-foreground">Threshold 0.0–1.0 共 21 個點</p>
          </CardHeader>
          <CardContent>
            <ROCCurveChart threshold={churnThreshold} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">混淆矩陣</CardTitle>
            <p className="text-xs text-muted-foreground">Threshold = {(churnThreshold * 100).toFixed(0)}%</p>
          </CardHeader>
          <CardContent>
            <ConfusionMatrix threshold={churnThreshold} />
          </CardContent>
        </Card>
      </div>

      {/* Probability Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">機率分佈直方圖</CardTitle>
          <p className="text-xs text-muted-foreground">客戶依流失機率分 10 個區間</p>
        </CardHeader>
        <CardContent>
          <ChurnDistChart />
        </CardContent>
      </Card>

      {/* Feature Importance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">RFM 特徵重要性</CardTitle>
          <p className="text-xs text-muted-foreground">Random Forest Gini Impurity — 越高代表對流失分類貢獻越大</p>
        </CardHeader>
        <CardContent>
          {impLoading ? <Skeleton className="h-40 w-full" /> : !featureImportance?.length ? (
            <p className="text-sm text-muted-foreground">需要 Tree 模型 — run make train-tree</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={featureImportance} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => v.toFixed(2)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="feature"
                  width={110}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  tickFormatter={(v: string) => FEATURE_LABELS[v] ?? v}
                />
                <Tooltip formatter={(v) => [Number(v).toFixed(4), 'Importance']} contentStyle={{ fontSize: '12px', borderRadius: '6px', border: '1px solid var(--color-border)' }} />
                <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                  {featureImportance.map((_, i) => (
                    <Cell key={i} fill="var(--color-primary)" fillOpacity={Math.max(0.3, 0.9 - i * 0.1)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Risk Table */}
      <Card data-tour="churn-table">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('mlInsights.churnTable.title')}</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('mlInsights.churnTable.minProb')}:</span>
            {[0.3, 0.5, 0.7, 0.9].map((v) => (
              <button key={v} onClick={() => setChurnThreshold(v)}
                className={cn('px-2 py-1 rounded text-xs border transition-colors',
                  churnThreshold === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted')}>
                {(v * 100).toFixed(0)}%
              </button>
            ))}
            <button
              onClick={() => churnData && exportCSV(
                churnData.map(r => ({ customer_id: r.customer_id, segment: r.segment ?? '', churn_probability: r.churn_probability, risk_level: r.risk_level, recency_days: r.recency_days ?? '' })),
                'churn-risk.csv'
              )}
              disabled={!churnData?.length}
              className="flex items-center gap-1 px-2 py-1 rounded border border-border text-xs text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
            >
              <Download className="w-3 h-3" />
              CSV
            </button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {churnLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : !churnData?.length ? (
            <p className="text-sm text-muted-foreground p-4">{t('common.runTrainDl')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-xs text-muted-foreground text-left">
                  <th className="px-4 py-2">{t('mlInsights.churnTable.customerId')}</th>
                  <th className="px-4 py-2">{t('mlInsights.churnTable.segment')}</th>
                  <th className="px-4 py-2">{t('mlInsights.churnTable.probability')}</th>
                  <th className="px-4 py-2">{t('mlInsights.churnTable.riskLevel')}</th>
                  <th className="px-4 py-2 text-right">{t('mlInsights.churnTable.recency')}</th>
                </tr>
              </thead>
              <tbody>
                {churnData.map((row) => (
                  <tr key={row.customer_id} className="border-t border-border hover:bg-primary/5 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs">{row.customer_id}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{row.segment ?? '—'}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                          <div className={cn('h-full rounded-full', {
                            'bg-green-500':  row.churn_probability < 0.3,
                            'bg-yellow-500': row.churn_probability < 0.6,
                            'bg-orange-500': row.churn_probability < 0.8,
                            'bg-red-500':    row.churn_probability >= 0.8,
                          })} style={{ width: `${Math.round(row.churn_probability * 100)}%` }} />
                        </div>
                        <span className="tabular-nums text-xs">{(row.churn_probability * 100).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={cn('px-2 py-0.5 rounded border text-xs font-medium', RISK_BADGE[row.risk_level] ?? 'bg-muted')}>
                        {row.risk_level}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.recency_days ?? '—'}</td>
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

// ── CLV Tab ───────────────────────────────────────────────────────────────────
function CLVTab() {
  const { t } = useI18n()
  const { data: topClv, isLoading } = useCLVRanking(50)

  const { histData, segmentData } = useMemo(() => {
    if (!topClv?.length) return { histData: [], segmentData: [] }
    const values = topClv.map(c => c.predicted_clv).filter(v => v > 0)
    if (!values.length) return { histData: [], segmentData: [] }
    const min = Math.min(...values)
    const max = Math.max(...values)
    const step = (max - min) / 8
    const buckets = Array.from({ length: 8 }, (_, i) => ({
      range: `£${Math.round((min + i * step) / 1000)}k`,
      count: 0,
    }))
    values.forEach(v => {
      const idx = Math.min(Math.floor((v - min) / step), 7)
      buckets[idx].count++
    })
    // Segment avg CLV
    const segMap: Record<string, { sum: number; count: number }> = {}
    topClv.forEach(c => {
      const seg = c.segment ?? 'Unknown'
      if (!segMap[seg]) segMap[seg] = { sum: 0, count: 0 }
      segMap[seg].sum += c.predicted_clv
      segMap[seg].count++
    })
    const segmentData = Object.entries(segMap)
      .map(([seg, s]) => ({ segment: seg, avg: Math.round(s.sum / s.count) }))
      .sort((a, b) => b.avg - a.avg)
    return { histData: buckets, segmentData }
  }, [topClv])

  const SEG_COLORS: Record<string, string> = {
    'Champions': '#22c55e', 'Loyal Customers': '#3b82f6', 'At Risk': '#f59e0b', 'Lost': '#ef4444', 'Unknown': '#94a3b8'
  }

  return (
    <div className="space-y-4">
      <DynamicInsight insight="CLV 回歸模型（MLP）預測每位客戶未來消費潛力，幫助識別高價值客群進行精準行銷。" variant="info" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CLV Distribution */}
        <Card data-tour="clv-dist">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">CLV 分佈直方圖</CardTitle>
            <p className="text-xs text-muted-foreground">預測客戶終身價值分佈（Top 50）</p>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-40 w-full" /> : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={histData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="range" tick={{ fontSize: 9, fill: 'var(--color-muted-foreground)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={24} />
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid var(--color-border)' }} />
                  <Bar dataKey="count" name="客戶數" fill="var(--color-primary)" radius={[3, 3, 0, 0]} fillOpacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Segment Avg CLV */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">分群平均 CLV</CardTitle>
            <p className="text-xs text-muted-foreground">各 RFM 群組的預測終身價值平均</p>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-40 w-full" /> : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={segmentData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="segment" tick={{ fontSize: 9, fill: 'var(--color-muted-foreground)' }} tickLine={false} />
                  <YAxis tickFormatter={(v) => `£${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip formatter={(v) => [`£${v != null ? Number(v).toLocaleString() : '—'}`, '平均 CLV']} contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid var(--color-border)' }} />
                  <Bar dataKey="avg" name="平均 CLV" radius={[4, 4, 0, 0]}>
                    {segmentData.map((d, i) => (
                      <Cell key={i} fill={SEG_COLORS[d.segment] ?? '#94a3b8'} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top CLV Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('mlInsights.clv.topCustomers')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : !topClv?.length ? (
            <p className="text-sm text-muted-foreground p-4">{t('mlInsights.clv.runHint')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-xs text-muted-foreground text-left">
                  <th className="px-4 py-2">{t('mlInsights.clv.id')}</th>
                  <th className="px-4 py-2">{t('mlInsights.clv.segment')}</th>
                  <th className="px-4 py-2 text-right">{t('mlInsights.clv.predicted')}</th>
                  <th className="px-4 py-2 text-right">{t('mlInsights.clv.current')}</th>
                  <th className="px-4 py-2 text-right">成長潛力</th>
                </tr>
              </thead>
              <tbody>
                {topClv.slice(0, 20).map((row) => {
                  const growth = row.current_monetary > 0 ? ((row.predicted_clv - row.current_monetary) / row.current_monetary) * 100 : null
                  return (
                    <tr key={row.customer_id} className="border-t border-border hover:bg-primary/5">
                      <td className="px-4 py-2 font-mono text-xs">{row.customer_id}</td>
                      <td className="px-4 py-2 text-xs">
                        <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: `${SEG_COLORS[row.segment ?? 'Unknown']}22`, color: SEG_COLORS[row.segment ?? 'Unknown'] }}>
                          {row.segment ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-primary">£{row.predicted_clv.toFixed(0)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">£{row.current_monetary.toFixed(0)}</td>
                      <td className="px-4 py-2 text-right text-xs">
                        {growth != null ? (
                          <span className={growth >= 0 ? 'text-green-600 font-semibold' : 'text-red-500'}>
                            {growth >= 0 ? '+' : ''}{growth.toFixed(0)}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Anomaly Customer Deep Dive ─────────────────────────────────────────────────
function AnomalyDeepDive({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { data: anomalyData } = useAnomalies(50)
  const { data: history, isLoading } = useCustomerPurchaseHistory(customerId)
  const customer = anomalyData?.find(c => c.customer_id === customerId)

  return (
    <div className="border border-border rounded-xl p-4 bg-muted/30 space-y-3 animate-in fade-in duration-200">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Customer {customerId}</p>
          <div className="flex items-center gap-2">
            {customer && (
              <>
                <span className="text-xs text-muted-foreground">Anomaly Score:</span>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-500"
                      style={{ width: `${Math.round(customer.anomaly_score * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono tabular-nums">{customer.anomaly_score.toFixed(4)}</span>
                </div>
                {customer.segment && (
                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">{customer.segment}</span>
                )}
              </>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed max-w-md">
            重建誤差 = Autoencoder 看到這位客戶的消費行為，覺得「跟大家太不一樣」的程度。分數越高，行為越異常。
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs">✕</button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !history?.length ? (
        <p className="text-xs text-muted-foreground py-4 text-center">無歷史購買資料</p>
      ) : (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">月度購買金額</p>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={history} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--color-muted-foreground)' }} tickLine={false} interval={1} />
              <YAxis tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} width={40} />
              <Tooltip formatter={(v) => [`£${Number(v).toLocaleString()}`, '購買金額']} contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid var(--color-border)' }} />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── 異常偵測 Tab ──────────────────────────────────────────────────────────────
function AnomalyTab() {
  const { t } = useI18n()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: anomalyData, isLoading: anomalyLoading } = useAnomalies(50)

  const histData = useMemo(() => {
    if (!anomalyData?.length) return []
    const bins = Array.from({ length: 10 }, (_, i) => ({
      range: `${(i * 0.1).toFixed(1)}–${((i + 1) * 0.1).toFixed(1)}`,
      normal: 0,
      anomaly: 0,
    }))
    anomalyData.forEach(c => {
      const idx = Math.min(Math.floor(c.anomaly_score * 10), 9)
      if (c.is_anomaly) bins[idx].anomaly++
      else bins[idx].normal++
    })
    return bins
  }, [anomalyData])

  const anomalyCount = (anomalyData ?? []).filter(c => c.is_anomaly).length

  return (
    <div className="space-y-4">
      <DynamicInsight insight="Autoencoder 重建誤差超過均值 + 2σ 閾值的客戶被標記為異常，可能是高消費客戶或資料異常。" variant="info" />

      {/* Score Distribution */}
      <Card data-tour="anomaly-dist">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">異常分數分佈</CardTitle>
          <p className="text-xs text-muted-foreground">藍色=正常客戶 · 紅色=異常客戶</p>
        </CardHeader>
        <CardContent>
          {anomalyLoading ? <Skeleton className="h-40 w-full" /> : (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={histData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="range" tick={{ fontSize: 9, fill: 'var(--color-muted-foreground)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={24} />
                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid var(--color-border)' }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="normal" name="正常" fill="#3b82f6" fillOpacity={0.7} radius={[2, 2, 0, 0]} stackId="a" />
                <Bar dataKey="anomaly" name="異常" fill="#ef4444" fillOpacity={0.8} radius={[2, 2, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Anomaly Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">{t('mlInsights.anomaly.title')}
              <span className="ml-2 text-xs font-normal text-muted-foreground">（異常客戶：{anomalyCount}）</span>
            </CardTitle>
            <p className="text-[10px] text-muted-foreground mt-0.5">點擊任一行展開月度購買走勢</p>
          </div>
          <button
            onClick={() => anomalyData && exportCSV(
              anomalyData.map(r => ({ customer_id: r.customer_id, segment: r.segment ?? '', anomaly_score: r.anomaly_score, is_anomaly: r.is_anomaly })),
              'anomalies.csv'
            )}
            disabled={!anomalyData?.length}
            className="flex items-center gap-1 px-2 py-1 rounded border border-border text-xs text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
        </CardHeader>
        <CardContent className="p-0 space-y-0">
          {anomalyLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
          ) : !anomalyData?.length ? (
            <p className="text-sm text-muted-foreground p-4">{t('common.runTrainDl')}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-xs text-muted-foreground text-left">
                      <th className="px-4 py-2">{t('mlInsights.anomaly.id')}</th>
                      <th className="px-4 py-2">{t('mlInsights.anomaly.segment')}</th>
                      <th className="px-4 py-2 text-right">{t('mlInsights.anomaly.score')}</th>
                      <th className="px-4 py-2 text-right">{t('mlInsights.anomaly.label')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalyData.slice(0, 30).map((row) => (
                      <tr
                        key={row.customer_id}
                        onClick={() => setSelectedId(selectedId === row.customer_id ? null : row.customer_id)}
                        className={cn(
                          'border-t border-border cursor-pointer transition-colors',
                          selectedId === row.customer_id ? 'bg-primary/10' : 'hover:bg-primary/5',
                        )}
                      >
                        <td className="px-4 py-2 font-mono text-xs">{row.customer_id}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{row.segment ?? '—'}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.anomaly_score.toFixed(4)}</td>
                        <td className="px-4 py-2 text-right">
                          {row.is_anomaly ? (
                            <span className="px-2 py-0.5 rounded border text-xs font-medium bg-red-50 text-red-700 border-red-200">
                              {t('mlInsights.anomaly.anomaly')}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded border text-xs font-medium bg-green-50 text-green-700 border-green-200">
                              {t('mlInsights.anomaly.normal')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedId && (
                <div className="p-4 border-t border-border">
                  <AnomalyDeepDive customerId={selectedId} onClose={() => setSelectedId(null)} />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── 模型比較 Tab ──────────────────────────────────────────────────────────────
function CompareTab() {
  const { t } = useI18n()
  const { data: comparison, isLoading: cmpLoading } = useChurnModelComparison()
  const { data: importance, isLoading: impLoading } = useFeatureImportance()
  const { data: registry, isLoading: registryLoading } = useModelRegistry()

  const aucData = comparison?.map((m) => ({
    name: m.model_name,
    aucRoc: m.auc_roc != null ? Number((m.auc_roc * 100).toFixed(1)) : 0,
    f1:     m.f1 != null     ? Number((m.f1 * 100).toFixed(1))       : 0,
    precision: m.precision != null ? Number((m.precision * 100).toFixed(1)) : 0,
    recall:    m.recall != null    ? Number((m.recall * 100).toFixed(1))    : 0,
  })) ?? []

  const bestModel = aucData.length ? aucData.reduce((a, b) => a.aucRoc > b.aucRoc ? a : b) : null
  const insightText = bestModel ? `最佳分類器：${bestModel.name}（AUC-ROC ${bestModel.aucRoc}%，F1 ${bestModel.f1}%）` : null

  return (
    <div className="space-y-4">
      {insightText && <DynamicInsight insight={insightText} variant="success" />}

      {/* AUC-ROC + F1 + Precision + Recall */}
      <Card data-tour="model-compare">
        <CardHeader>
          <CardTitle className="text-base">{t('mlInsights.compare.title')}</CardTitle>
          <p className="text-xs text-muted-foreground">Decision Tree · Random Forest · Gradient Boosting · MLP</p>
        </CardHeader>
        <CardContent>
          {cmpLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : !comparison?.length ? (
            <p className="text-sm text-muted-foreground">{t('mlInsights.compare.runHint')}</p>
          ) : (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={aucData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} tickLine={false} axisLine={false} width={44} domain={[0, 100]} />
                  <Tooltip formatter={(v, name) => [`${v}%`, name === 'aucRoc' ? 'AUC-ROC' : name === 'f1' ? 'F1' : name === 'precision' ? 'Precision' : 'Recall']} contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid var(--color-border)' }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => ({ aucRoc: 'AUC-ROC', f1: 'F1', precision: 'Precision', recall: 'Recall' }[v] ?? v)} />
                  <Bar dataKey="aucRoc" radius={[4, 4, 0, 0]} fillOpacity={0.9}>
                    {aucData.map((e, i) => <Cell key={i} fill={MODEL_COLORS[e.name] ?? 'var(--color-primary)'} />)}
                  </Bar>
                  <Bar dataKey="f1" radius={[4, 4, 0, 0]} fillOpacity={0.5}>
                    {aucData.map((e, i) => <Cell key={i} fill={MODEL_COLORS[e.name] ?? 'var(--color-primary)'} />)}
                  </Bar>
                  <Bar dataKey="precision" radius={[4, 4, 0, 0]} fillOpacity={0.35}>
                    {aucData.map((e, i) => <Cell key={i} fill={MODEL_COLORS[e.name] ?? 'var(--color-primary)'} />)}
                  </Bar>
                  <Bar dataKey="recall" radius={[4, 4, 0, 0]} fillOpacity={0.25}>
                    {aucData.map((e, i) => <Cell key={i} fill={MODEL_COLORS[e.name] ?? 'var(--color-primary)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Metrics table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 text-muted-foreground">
                      <th className="px-3 py-1.5 text-left">模型</th>
                      <th className="px-3 py-1.5 text-right">AUC-ROC</th>
                      <th className="px-3 py-1.5 text-right">F1</th>
                      <th className="px-3 py-1.5 text-right">Precision</th>
                      <th className="px-3 py-1.5 text-right">Recall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aucData.map((m, i) => (
                      <tr key={i} className={cn('border-t border-border', m.name === bestModel?.name && 'bg-primary/5')}>
                        <td className="px-3 py-1.5 font-medium flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: MODEL_COLORS[m.name] ?? '#94a3b8' }} />
                          {m.name}
                          {m.name === bestModel?.name && <span className="ml-1 text-[9px] bg-primary/10 text-primary px-1 rounded">最佳</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{m.aucRoc}%</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{m.f1}%</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{m.precision}%</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{m.recall}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature Importance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('mlInsights.compare.feature')}</CardTitle>
          <p className="text-xs text-muted-foreground">Random Forest · Gini Impurity 重要性排名</p>
        </CardHeader>
        <CardContent>
          {impLoading ? <Skeleton className="h-44 w-full" /> : !importance?.length ? (
            <p className="text-sm text-muted-foreground">{t('mlInsights.compare.runHint')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={importance} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => v.toFixed(2)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="feature" width={100} tick={{ fontSize: 11 }} tickLine={false} />
                <Tooltip formatter={(v) => [Number(v).toFixed(4), 'Importance']} contentStyle={{ fontSize: '12px', borderRadius: '6px', border: '1px solid var(--color-border)' }} />
                <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                  {(importance ?? []).map((_, i) => <Cell key={i} fill="var(--color-primary)" fillOpacity={0.7 - i * 0.07} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Model Registry */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t('mlInsights.registry.title')}</CardTitle></CardHeader>
        <CardContent>
          {registryLoading ? (
            <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : !registry?.length ? (
            <p className="text-sm text-muted-foreground">{t('common.runTrainAll')}</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {registry.map((m) => (
                <div key={m.model_id} className="rounded-lg border border-border p-3 space-y-1">
                  <p className="font-medium text-xs truncate">{m.model_name}</p>
                  <p className="text-[10px] text-muted-foreground">{m.model_type}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {Object.entries(m.metrics).slice(0, 2).map(([k, v]) => (
                      <span key={k} className="px-1 py-0.5 rounded bg-muted text-[10px] tabular-nums">
                        {k}: {typeof v === 'number' ? v.toFixed(3) : String(v ?? '—')}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── 主頁面 ────────────────────────────────────────────────────────────────────
export default function MLInsightsPage() {
  const { t } = useI18n()

  return (
    <div className="space-y-6 max-w-screen-xl">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('mlInsights.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('mlInsights.subtitle')}</p>
      </div>

      <Tabs data-tour="ml-tabs" defaultValue="churn">
        <TabsList className="mb-4">
          <TabsTrigger value="churn">{t('mlInsights.tabs.churn')}</TabsTrigger>
          <TabsTrigger value="clv">{t('mlInsights.tabs.clv')}</TabsTrigger>
          <TabsTrigger value="anomaly">{t('mlInsights.tabs.anomaly')}</TabsTrigger>
          <TabsTrigger value="compare">
            <GitCompare className="w-3.5 h-3.5 mr-1" />
            {t('mlInsights.tabs.compare')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="churn"><ChurnTab /></TabsContent>
        <TabsContent value="clv"><CLVTab /></TabsContent>
        <TabsContent value="anomaly"><AnomalyTab /></TabsContent>
        <TabsContent value="compare"><CompareTab /></TabsContent>
      </Tabs>
    </div>
  )
}
