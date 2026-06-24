'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { KPICard } from '@/components/cards/KPICard'
import { useExperiments, useExperimentResults, useExperimentSummary } from '@/hooks/useApi'
import { FlaskConical, CheckCircle2, XCircle, Calculator, Plus, RefreshCw, Play, Pause, RotateCcw } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useI18n } from '@/contexts/I18nContext'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import type { ABExperiment, ABResult } from '@/types/index'

// ── Math helpers ──────────────────────────────────────────────────────────────

function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const poly =
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const phi = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly
  return z >= 0 ? phi : 1 - phi
}

function computePower(
  controlRate: number,
  treatmentRate: number,
  n: number,
  alpha = 0.05,
): number {
  const p = (controlRate + treatmentRate) / 2
  const se = Math.sqrt((2 * p * (1 - p)) / n)
  if (se === 0) return 0
  const z_alpha = 1.96
  const z = Math.abs(treatmentRate - controlRate) / se
  return Math.min(0.999, normalCDF(z - z_alpha))
}

function wilsonCI(conversions: number, n: number): [number, number] {
  if (n === 0) return [0, 0]
  const z = 1.96
  const p = conversions / n
  const center = (p + (z * z) / (2 * n)) / (1 + (z * z) / n)
  const margin =
    (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n)
  return [Math.max(0, center - margin), Math.min(1, center + margin)]
}

function logGamma(n: number): number {
  if (n < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * n)) - logGamma(1 - n)
  n -= 1
  let x = 0.99999999999980993
  const c = [
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]
  for (let i = 0; i < 8; i++) x += c[i] / (n + i + 1)
  const t = n + 7.5
  return (
    Math.log(2 * Math.PI) / 2 + (n + 0.5) * Math.log(t) - t + Math.log(x)
  )
}

function betaPDF(x: number, a: number, b: number): number {
  if (x <= 0 || x >= 1) return 0
  const logBeta = logGamma(a) + logGamma(b) - logGamma(a + b)
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logBeta)
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SummaryRow = {
  variant: string
  total_events: number
  conversions: number
  impressions: number
}

type FunnelRow = {
  variant: string
  impressions: number
  conversions: number
  rate: string
}

type BetaPoint = { x: number; control: number; treatment: number }

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'active'
      ? 'bg-green-50 text-green-700 border-green-200'
      : status === 'completed'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-muted text-muted-foreground'
  return (
    <span className={cn('px-2 py-0.5 rounded border text-xs font-medium', cls)}>
      {status}
    </span>
  )
}

// ── ExperimentSimulator helpers ───────────────────────────────────────────────

function computeRequiredN(p1: number, p2: number, targetPower: number, alpha: number): number {
  if (Math.abs(p2 - p1) < 1e-9) return 1_000_000
  let lo = 10, hi = 1_000_000
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (computePower(p1, p2, mid, alpha) >= targetPower) hi = mid
    else lo = mid + 1
  }
  return lo
}

function computePValue(n: number, baseline: number, mdeAbs: number): number {
  if (n < 2) return 1
  const pPool = baseline + mdeAbs / 2
  const se = Math.sqrt(pPool * (1 - pPool) * 2 / n)
  if (se === 0) return 1
  const z = Math.abs(mdeAbs) / se
  return Math.min(1, 2 * (1 - normalCDF(z)))
}

function SliderRow({
  label, value, min, max, step, display, onChange,
}: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <label className="text-xs text-muted-foreground">{label}</label>
        <span className="text-xs font-semibold tabular-nums w-14 text-right">{display}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
      />
    </div>
  )
}

function SummaryMetric({
  label, value, unit, accent,
}: { label: string; value: string; unit: string; accent: 'primary' | 'success' | 'warning' | 'default' }) {
  const color = { primary: 'text-primary', success: 'text-green-600', warning: 'text-amber-500', default: 'text-foreground' }[accent]
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value} <span className="text-[10px] font-normal">{unit}</span></span>
    </div>
  )
}

type SimState = 'idle' | 'running' | 'paused' | 'done'

// ── ExperimentSimulator ───────────────────────────────────────────────────────

function ExperimentSimulator() {
  const [dailyVisitors, setDailyVisitors] = useState(500)
  const [baselinePct, setBaselinePct] = useState(5)
  const [liftPct, setLiftPct] = useState(20)
  const [targetPower, setTargetPower] = useState(0.8)
  const [alpha, setAlpha] = useState(0.05)
  const [simState, setSimState] = useState<SimState>('idle')
  const [simulationDay, setSimulationDay] = useState(0)
  const [speed, setSpeed] = useState(3)

  const baseline = baselinePct / 100
  const mdeAbs = baseline * (liftPct / 100)
  const treatment = baseline + mdeAbs

  const { requiredN, requiredDays } = useMemo(() => {
    const n = computeRequiredN(baseline, treatment, targetPower, alpha)
    const days = Math.ceil(n / (dailyVisitors / 2))
    return { requiredN: n, requiredDays: days }
  }, [baseline, treatment, targetPower, alpha, dailyVisitors])

  const simMaxDay = Math.ceil(requiredDays * 1.3)

  const simData = useMemo(() => {
    if (simulationDay === 0) return []
    const pts: { day: number; power: number; pval: number }[] = []
    const step = Math.max(1, Math.floor(simMaxDay / 200))
    for (let day = step; day <= simulationDay; day += step) {
      const n = Math.max(1, Math.floor((dailyVisitors / 2) * day))
      const power = computePower(baseline, treatment, n, alpha) * 100
      const pval = computePValue(n, baseline, mdeAbs)
      pts.push({ day, power: Number(power.toFixed(1)), pval: Number(pval.toFixed(4)) })
    }
    return pts
  }, [simulationDay, simMaxDay, dailyVisitors, baseline, treatment, mdeAbs, alpha])

  const sigDay = useMemo(() => {
    for (const p of simData) {
      if (p.power >= targetPower * 100 && p.pval <= alpha) return p.day
    }
    return null
  }, [simData, targetPower, alpha])

  // Animation loop
  useEffect(() => {
    if (simState !== 'running') return
    const interval = setInterval(() => {
      setSimulationDay(d => {
        const next = d + speed
        if (next >= simMaxDay) {
          setSimState('done')
          return simMaxDay
        }
        return next
      })
    }, 60)
    return () => clearInterval(interval)
  }, [simState, speed, simMaxDay])

  // Reset animation when inputs change
  useEffect(() => {
    setSimState('idle')
    setSimulationDay(0)
  }, [dailyVisitors, baselinePct, liftPct, targetPower, alpha])

  const handleRun = () => {
    if (simState === 'idle' || simState === 'done') {
      setSimulationDay(0)
      setSimState('running')
    } else if (simState === 'running') {
      setSimState('paused')
    } else {
      setSimState('running')
    }
  }

  return (
    <div className="space-y-5">
      {/* Inputs + Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <SliderRow label="每日訪客數" value={dailyVisitors} min={50} max={5000} step={50}
            display={dailyVisitors.toLocaleString()} onChange={setDailyVisitors} />
          <SliderRow label="基準轉換率" value={baselinePct} min={1} max={30} step={0.5}
            display={`${baselinePct}%`} onChange={setBaselinePct} />
          <SliderRow label="預期提升（相對）" value={liftPct} min={1} max={50} step={1}
            display={`+${liftPct}%`} onChange={setLiftPct} />
          <div className="flex gap-3">
            <div className="space-y-1 flex-1">
              <label className="text-xs text-muted-foreground">目標功效</label>
              <select value={targetPower} onChange={e => setTargetPower(Number(e.target.value))}
                className="w-full h-8 text-xs rounded-md border border-border bg-background px-2">
                <option value={0.7}>70%</option>
                <option value={0.8}>80%（建議）</option>
                <option value={0.9}>90%</option>
              </select>
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-xs text-muted-foreground">顯著水準 α</label>
              <select value={alpha} onChange={e => setAlpha(Number(e.target.value))}
                className="w-full h-8 text-xs rounded-md border border-border bg-background px-2">
                <option value={0.1}>10%（α=0.10）</option>
                <option value={0.05}>5%（α=0.05）</option>
                <option value={0.01}>1%（α=0.01）</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">即時估算</p>
          <SummaryMetric label="每變體所需樣本" value={requiredN.toLocaleString()} unit="人" accent="primary" />
          <SummaryMetric label="預計實驗天數" value={requiredDays.toLocaleString()} unit="天"
            accent={requiredDays > 60 ? 'warning' : 'success'} />
          <SummaryMetric label="絕對 MDE" value={(mdeAbs * 100).toFixed(2)} unit="%" accent="default" />
          <p className="text-[10px] text-muted-foreground">
            MDE = {baselinePct}% × {liftPct}% = {(mdeAbs*100).toFixed(2)}%
            → 處理組目標 {(treatment*100).toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <button onClick={handleRun}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
          {simState === 'running' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {simState === 'idle' || simState === 'done' ? '開始模擬' : simState === 'running' ? '暫停' : '繼續'}
        </button>
        <button onClick={() => { setSimState('idle'); setSimulationDay(0) }}
          disabled={simState === 'idle'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30">
          <RotateCcw className="w-3.5 h-3.5" />重置
        </button>
        <span className="text-xs text-muted-foreground ml-1">速度：</span>
        {[1, 3, 10].map(s => (
          <button key={s} onClick={() => setSpeed(s)}
            className={cn('px-2 py-0.5 rounded text-xs border transition-colors', speed === s
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border hover:bg-muted')}>
            {s}x
          </button>
        ))}
        {simState !== 'idle' && (
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            Day {simulationDay} / {simMaxDay}
          </span>
        )}
      </div>

      {/* Charts */}
      {simData.length > 0 && (
        <div className="space-y-2">
          {sigDay && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              第 {sigDay} 天達到統計顯著（Power ≥ {(targetPower*100).toFixed(0)}%，p ≤ {alpha}）
            </div>
          )}

          {/* Power curve */}
          <div>
            <p className="text-[10px] text-muted-foreground px-1 mb-0.5">統計功效（Power）</p>
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={simData} margin={{ top: 4, right: 48, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" tick={{ fontSize: 9 }} tickLine={false} hide />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip formatter={(v) => [`${v}%`, 'Power']}
                  contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid var(--color-border)' }} />
                <ReferenceLine y={targetPower * 100} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1.5}
                  label={{ value: `${(targetPower*100).toFixed(0)}%`, position: 'right', fontSize: 9, fill: '#22c55e' }} />
                {sigDay && <ReferenceLine x={sigDay} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} />}
                <Line type="monotone" dataKey="power" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* p-value curve */}
          <div>
            <p className="text-[10px] text-muted-foreground px-1 mb-0.5">p-value（雙尾 z-test）</p>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={simData} margin={{ top: 4, right: 48, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--color-muted-foreground)' }} tickLine={false}
                  label={{ value: '天數', position: 'insideBottomRight', offset: -4, fontSize: 9, fill: 'var(--color-muted-foreground)' }} />
                <YAxis domain={[0, 1]} tickFormatter={v => v.toFixed(1)} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip formatter={(v) => [Number(v).toFixed(4), 'p-value']}
                  contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid var(--color-border)' }} />
                <ReferenceLine y={alpha} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5}
                  label={{ value: `α=${alpha}`, position: 'right', fontSize: 9, fill: '#ef4444' }} />
                {sigDay && <ReferenceLine x={sigDay} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} />}
                <Line type="monotone" dataKey="pval" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ResultCard ────────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: ABResult }) {
  const lift =
    result.control_rate > 0
      ? ((result.treatment_rate - result.control_rate) / result.control_rate) * 100
      : 0

  const chartData = [
    {
      name: result.control_variant,
      rate: result.control_rate * 100,
      fill: 'var(--color-muted-foreground)',
    },
    {
      name: result.treatment_variant,
      rate: result.treatment_rate * 100,
      fill: result.significant ? 'var(--color-primary)' : 'var(--color-accent)',
    },
  ]

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-medium text-sm capitalize">{result.metric.replace(/_/g, ' ')}</p>
        {result.significant ? (
          <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Significant
          </div>
        ) : (
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <XCircle className="w-3.5 h-3.5" />
            Not significant
          </div>
        )}
      </div>

      {/* variant bar comparison */}
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 40 }}>
          <XAxis
            type="number"
            domain={[0, 'auto']}
            tickFormatter={(v) => `${v.toFixed(1)}%`}
            tick={{ fontSize: 10 }}
          />
          <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Rate']} />
          <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">p-value</p>
          <p className="font-mono tabular-nums">{result.p_value.toFixed(4)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Effect size</p>
          <p className="font-mono tabular-nums">{result.effect_size.toFixed(3)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Lift</p>
          <p
            className={cn(
              'font-mono tabular-nums font-medium',
              lift >= 0 ? 'text-green-600' : 'text-red-600',
            )}
          >
            {lift >= 0 ? '+' : ''}
            {lift.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  )
}

// ── FunnelCard ────────────────────────────────────────────────────────────────

function FunnelCard({ summaryData }: { summaryData: SummaryRow[] }) {
  const funnelData: FunnelRow[] = summaryData.map((s) => ({
    variant: s.variant,
    impressions: s.impressions || s.total_events - s.conversions,
    conversions: s.conversions,
    rate:
      s.total_events > 0
        ? ((s.conversions / s.total_events) * 100).toFixed(1)
        : '0',
  }))

  return (
    <Card data-tour="ab-funnel">
      <CardHeader>
        <CardTitle className="text-base">轉換漏斗</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={funnelData}
            layout="vertical"
            margin={{ left: 0, right: 60, top: 4, bottom: 4 }}
          >
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis
              type="category"
              dataKey="variant"
              width={80}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                Number(value).toLocaleString(),
                name === 'impressions' ? 'Impressions' : 'Conversions',
              ]}
            />
            <Legend />
            <Bar
              dataKey="impressions"
              name="Impressions"
              fill="var(--color-muted-foreground)"
              radius={[0, 4, 4, 0]}
            />
            <Bar
              dataKey="conversions"
              name="Conversions"
              fill="var(--color-primary)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-4">
          {funnelData.map((row) => (
            <div key={row.variant} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground capitalize">{row.variant}</span>:{' '}
              {row.rate}% conversion rate
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── PowerCard ─────────────────────────────────────────────────────────────────

function PowerCard({
  results,
  summaryData,
}: {
  results: ABResult[]
  summaryData: SummaryRow[]
}) {
  const firstResult = results[0]
  const controlRate = firstResult.control_rate
  const treatmentRate = firstResult.treatment_rate
  const n = Math.round(summaryData?.[0]?.total_events ?? 100)

  const power = computePower(controlRate, treatmentRate, n)
  const powerPct = (power * 100).toFixed(1)

  const controlRow =
    summaryData.find((s) => s.variant === firstResult.control_variant) ??
    summaryData[0]
  const treatmentRow =
    summaryData.find((s) => s.variant === firstResult.treatment_variant) ??
    summaryData[1]

  const controlN = controlRow?.total_events ?? n
  const treatmentN = treatmentRow?.total_events ?? n
  const controlConversions = controlRow?.conversions ?? Math.round(controlRate * n)
  const treatmentConversions =
    treatmentRow?.conversions ?? Math.round(treatmentRate * n)

  const [cLow, cHigh] = wilsonCI(controlConversions, controlN)
  const [tLow, tHigh] = wilsonCI(treatmentConversions, treatmentN)

  const lift =
    controlRate > 0
      ? ((treatmentRate - controlRate) / controlRate) * 100
      : 0

  const powerBarColor =
    power >= 0.8 ? 'bg-green-500' : power >= 0.6 ? 'bg-amber-400' : 'bg-red-500'
  const powerTextColor =
    power >= 0.8
      ? 'text-green-600'
      : power >= 0.6
      ? 'text-amber-600'
      : 'text-red-600'
  const powerNote =
    power >= 0.8
      ? 'Sufficient power to detect the observed effect.'
      : power >= 0.6
      ? 'Moderate power — consider increasing sample size.'
      : 'Low power — results may be inconclusive.'

  return (
    <Card data-tour="ab-power">
      <CardHeader>
        <CardTitle className="text-base">統計功效與信賴區間</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Power progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Observed Power</span>
            <span className={cn('font-semibold tabular-nums', powerTextColor)}>
              {powerPct}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', powerBarColor)}
              style={{ width: `${Math.min(100, power * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{powerNote}</p>
        </div>

        {/* CI + lift grid */}
        <div className="grid grid-cols-3 gap-4 text-xs border-t pt-3">
          <div>
            <p className="text-muted-foreground mb-1">
              {firstResult.control_variant} 95% CI
            </p>
            <p className="font-mono tabular-nums">
              [{(cLow * 100).toFixed(2)}% — {(cHigh * 100).toFixed(2)}%]
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">
              {firstResult.treatment_variant} 95% CI
            </p>
            <p className="font-mono tabular-nums">
              [{(tLow * 100).toFixed(2)}% — {(tHigh * 100).toFixed(2)}%]
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Lift</p>
            <p
              className={cn(
                'font-mono tabular-nums font-semibold',
                lift >= 0 ? 'text-green-600' : 'text-red-600',
              )}
            >
              {lift >= 0 ? '+' : ''}
              {lift.toFixed(1)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── BayesianCard ──────────────────────────────────────────────────────────────

function BayesianCard({ summaryData }: { summaryData: SummaryRow[] }) {
  const chartData = useMemo<BetaPoint[]>(() => {
    if (summaryData.length < 2) return []

    const controlRow = summaryData[0]
    const treatmentRow = summaryData[1]

    const controlConv = controlRow.conversions
    const controlN = controlRow.total_events
    const treatmentConv = treatmentRow.conversions
    const treatmentN = treatmentRow.total_events

    const controlRate = controlN > 0 ? controlConv / controlN : 0.05
    const treatmentRate = treatmentN > 0 ? treatmentConv / treatmentN : 0.08
    const maxRate = Math.max(controlRate, treatmentRate)
    const xMax = Math.min(0.99, maxRate * 3)

    const aControl = controlConv + 1
    const bControl = controlN - controlConv + 1
    const aTreatment = treatmentConv + 1
    const bTreatment = treatmentN - treatmentConv + 1

    const NUM_POINTS = 100
    const dx = xMax / NUM_POINTS

    return Array.from({ length: NUM_POINTS }, (_, i) => {
      const x = (i + 0.5) * dx
      return {
        x: parseFloat(x.toFixed(5)),
        control: parseFloat(betaPDF(x, aControl, bControl).toFixed(4)),
        treatment: parseFloat(betaPDF(x, aTreatment, bTreatment).toFixed(4)),
      }
    })
  }, [summaryData])

  if (chartData.length === 0) return null

  const controlLabel = summaryData[0]?.variant ?? 'control'
  const treatmentLabel = summaryData[1]?.variant ?? 'treatment'

  return (
    <Card data-tour="ab-bayesian">
      <CardHeader>
        <CardTitle className="text-base">後驗信念分佈 (Beta 分佈)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Beta(α = conversions+1, β = non-conversions+1) posterior for each variant.
          Wider separation between curves indicates stronger evidence of a difference.
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
            <XAxis
              dataKey="x"
              tickFormatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
              tick={{ fontSize: 10 }}
            />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              labelFormatter={(v) => `Rate: ${(Number(v) * 100).toFixed(2)}%`}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                Number(value).toFixed(3),
                name === 'control' ? controlLabel : treatmentLabel,
              ]}
            />
            <Legend
              formatter={(value: string) =>
                value === 'control' ? controlLabel : treatmentLabel
              }
            />
            <Area
              type="monotone"
              dataKey="control"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.4}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="treatment"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.4}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ABTestingPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoProgress, setDemoProgress] = useState(0)
  const [demoError, setDemoError] = useState<string | null>(null)
  const { data: experiments, isLoading: expLoading } = useExperiments()
  const { data: results, isLoading: resultLoading } = useExperimentResults(selectedId)
  const { data: summaryData } = useExperimentSummary(selectedId)

  // Invalidate all A/B cache on mount to clear any stale empty state
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['ab'] })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-select the first experiment so results are visible on page load
  useEffect(() => {
    if (!selectedId && experiments?.length) {
      setSelectedId(experiments[0].experiment_id)
    }
  }, [experiments, selectedId])

  // Create demo experiment: create + batch-record 200 simulated events + analyze
  const createDemoExperiment = async () => {
    setDemoLoading(true)
    setDemoError(null)
    setDemoProgress(0)
    try {
      const API = '/api'
      const res = await fetch(`${API}/ab/experiments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Demo: Recommendation Strategy CTR',
          description: 'A/B test comparing CF vs Popularity recommendations',
          variants: ['control', 'treatment'],
        }),
      })
      if (!res.ok) throw new Error(`建立實驗失敗：${res.status}`)
      const created = await res.json()
      const expId = created.experiment_id

      // Batch send to avoid DuckDB write conflict
      const TOTAL = 200
      const BATCH = 5
      for (let i = 0; i < TOTAL; i += BATCH) {
        for (let j = 0; j < BATCH && i + j < TOTAL; j++) {
          const idx = i + j
          const variant = idx % 2 === 0 ? 'control' : 'treatment'
          const converted =
            variant === 'control' ? Math.random() < 0.05 : Math.random() < 0.08
          const eventRes = await fetch(`${API}/ab/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              experiment_id: expId,
              variant,
              event_type: converted ? 'conversion' : 'impression',
              user_id: `u${idx}`,
              value: converted ? 1.0 : 0.0,
            }),
          })
          if (!eventRes.ok) throw new Error(`事件寫入失敗：${eventRes.status}`)
        }
        setDemoProgress(Math.min(i + BATCH, TOTAL))
        await new Promise((resolve) => setTimeout(resolve, 25))
      }

      // Run statistical analysis
      const analyzeRes = await fetch(
        `${API}/ab/experiments/${expId}/analyze?metric=conversion_rate`,
        { method: 'POST' },
      )
      if (!analyzeRes.ok) throw new Error(`統計分析失敗：${analyzeRes.status}`)

      queryClient.invalidateQueries({ queryKey: ['ab', 'experiments'] })
      queryClient.invalidateQueries({ queryKey: ['ab', 'results', expId] })
      queryClient.invalidateQueries({ queryKey: ['ab', 'summary', expId] })
      setSelectedId(expId)
    } catch (e) {
      setDemoError((e as Error).message ?? '未知錯誤')
    }
    setDemoLoading(false)
    setDemoProgress(0)
  }

  const active = (experiments ?? []).filter((e) => e.status === 'active').length
  const total = experiments?.length ?? 0

  const hasResults = !!(selectedId && results && results.length > 0)
  const hasSummary = !!(summaryData && summaryData.length > 0)

  return (
    <div className="space-y-6 max-w-screen-xl">
      {/* Header */}
      <div className="border-b border-border pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('abTesting.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('abTesting.subtitle')}</p>
        </div>
        <button
          data-tour="demo-button"
          onClick={createDemoExperiment}
          disabled={demoLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
        >
          {demoLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {demoLoading && demoProgress > 0
            ? `建立中 ${demoProgress}/200`
            : demoLoading
            ? t('abTesting.demo.running')
            : t('abTesting.demo.buttonLabel')}
        </button>
      </div>

      {/* Error banner */}
      {demoError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <span className="font-medium shrink-0">⚠️ 示範建立失敗：</span>
          <span>{demoError}</span>
          <button
            onClick={() => setDemoError(null)}
            className="ml-auto shrink-0 text-amber-600 hover:text-amber-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard
          title={t('abTesting.kpi.total')}
          value={expLoading ? '—' : total}
          icon={FlaskConical}
          accent="primary"
          loading={expLoading}
        />
        <KPICard
          title={t('abTesting.kpi.active')}
          value={expLoading ? '—' : active}
          subtitle={t('abTesting.kpi.activeNote')}
          icon={CheckCircle2}
          accent="success"
          loading={expLoading}
        />
        <KPICard
          title={t('abTesting.kpi.completed')}
          value={expLoading ? '—' : total - active}
          icon={Calculator}
          accent="accent"
          loading={expLoading}
        />
      </div>

      {/* Experiment list + results grid */}
      <div className="grid grid-cols-5 gap-6">
        {/* Experiment list */}
        <div className="col-span-2" data-tour="experiment-list">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Experiments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {expLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : !experiments?.length ? (
                <div className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t('abTesting.experiments.noData')}
                  </p>
                  <button
                    onClick={createDemoExperiment}
                    disabled={demoLoading}
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Plus className="w-3 h-3" /> {t('abTesting.demo.buttonLabel')}
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {experiments.map((exp) => (
                    <button
                      key={exp.experiment_id}
                      onClick={() =>
                        setSelectedId(
                          exp.experiment_id === selectedId ? null : exp.experiment_id,
                        )
                      }
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors',
                        selectedId === exp.experiment_id &&
                          'bg-primary/5 border-l-2 border-primary',
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-medium">{exp.name}</p>
                        <StatusBadge status={exp.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {exp.variants?.join(' vs ')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results panel */}
        <div className="col-span-3 space-y-4">
          {selectedId ? (
            resultLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : !results?.length ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No results yet. Use POST /ab/experiments/{'{id}'}/analyze to compute.
                </CardContent>
              </Card>
            ) : (
              results.map((r, i) => <ResultCard key={i} result={r} />)
            )
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Select an experiment to view results
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* New visualizations — only when an experiment with results is selected */}
      {hasResults && hasSummary && (
        <div className="space-y-4">
          <FunnelCard summaryData={summaryData!} />
          <PowerCard results={results!} summaryData={summaryData!} />
          {summaryData!.length >= 2 && <BayesianCard summaryData={summaryData!} />}
        </div>
      )}

      {/* Experiment Simulator */}
      <Card data-tour="sample-calculator">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">實驗模擬器</CardTitle>
          <p className="text-xs text-muted-foreground">
            拖動滑桿設定實驗參數，即時估算所需天數，並動畫模擬 Power 與 p-value 隨時間的收斂過程
          </p>
        </CardHeader>
        <CardContent>
          <ExperimentSimulator />
        </CardContent>
      </Card>
    </div>
  )
}
