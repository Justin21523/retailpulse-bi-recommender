'use client'

import { useState, useRef, useEffect, type DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileUp, CheckCircle2, AlertCircle, Loader2, Database,
  Users, PieChart, ShoppingCart, CalendarDays, TrendingUp, Sparkles,
  Filter, FileCheck2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiFetch, apiPostFile, apiPostJSON } from '@/lib/api'
import { JOURNEY_STAGES } from '@/lib/journeyStages'
import { RawDataStage }         from '@/components/journey/stages/RawDataStage'
import { CleaningStage }        from '@/components/journey/stages/CleaningStage'
import { RFMStage }             from '@/components/journey/stages/RFMStage'
import { SegmentStage }         from '@/components/journey/stages/SegmentStage'
import { CohortStage }          from '@/components/journey/stages/CohortStage'
import { BasketStage }          from '@/components/journey/stages/BasketStage'
import { ChurnStage }           from '@/components/journey/stages/ChurnStage'
import { ForecastStage }        from '@/components/journey/stages/ForecastStage'
import { RecommendationStage }  from '@/components/journey/stages/RecommendationStage'
import { ABStage }              from '@/components/journey/stages/ABStage'
import { InsightStage }         from '@/components/journey/stages/InsightStage'
import { useI18n }              from '@/contexts/I18nContext'

// ── Static data ─────────────────────────────────────────────────────────────

// Journey stage components, indexed by JOURNEY_STAGES position
const STAGE_COMPONENTS = [
  RawDataStage, CleaningStage, RFMStage, SegmentStage,
  CohortStage, BasketStage, ChurnStage, ForecastStage,
  RecommendationStage, ABStage, InsightStage,
]

// Upload pipeline stage (0-10) → JOURNEY_STAGES index
const PIPELINE_TO_JOURNEY: number[] = [0, 1, 1, 2, 3, 5, 4, 6, 7, 8, 10]

// Left stepper icons, one per pipeline stage
const STAGE_ICONS = [
  FileCheck2, Filter, Database, Users, PieChart,
  ShoppingCart, CalendarDays, AlertCircle, TrendingUp, Sparkles, CheckCircle2,
]

const REQUIRED_COLS = [
  'InvoiceNo', 'StockCode', 'Description',
  'Quantity', 'InvoiceDate', 'UnitPrice', 'CustomerID', 'Country',
]

// ── Types ────────────────────────────────────────────────────────────────────

interface PipelineStatus {
  stage: number
  status: 'running' | 'done' | 'error'
  message: string
  error?: string
}

type Phase = 'idle' | 'running' | 'done' | 'error'

// ── Component ────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter()
  const { t }  = useI18n()

  const [phase,          setPhase]          = useState<Phase>('idle')
  const [jobId,          setJobId]          = useState<string | null>(null)
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null)
  const [isDragging,     setIsDragging]     = useState(false)
  const [fileError,      setFileError]      = useState<string | null>(null)
  const [dataSource,     setDataSource]     = useState<'csv' | 'sample' | null>(null)
  const [countdown,      setCountdown]      = useState(3)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollingRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  // Derive current stage info
  const pipelineStage = Math.min(pipelineStatus?.stage ?? 0, 10)
  const journeyIdx    = PIPELINE_TO_JOURNEY[pipelineStage]
  const StageComp     = STAGE_COMPONENTS[journeyIdx]
  const journeyStage  = JOURNEY_STAGES[journeyIdx]

  // Stage names from i18n (built inside component so t() is available)
  const STAGE_NAMES = Array.from({ length: 11 }, (_, i) => t('upload.stages.s' + i))

  // ── Polling ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!jobId || phase !== 'running') return
    pollingRef.current = setInterval(async () => {
      try {
        const status = await apiFetch<PipelineStatus>(`/upload/status/${jobId}`)
        setPipelineStatus(status)
        if (status.status === 'done') {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          setPhase('done')
        } else if (status.status === 'error') {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          setPhase('error')
        }
      } catch {
        // keep polling on transient errors
      }
    }, 800)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [jobId, phase])

  // ── Redirect countdown ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'done') return
    setCountdown(3)
    let c = 3
    const iv = setInterval(() => {
      c--
      setCountdown(c)
      if (c <= 0) {
        clearInterval(iv)
        sessionStorage.setItem('retailpulse:autoGuide', '1')
        router.push('/')
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [phase, router])

  // ── Handlers ────────────────────────────────────────────────────────────
  function validateFile(file: File): string | null {
    if (!file.name.toLowerCase().endsWith('.csv')) return 'Only CSV files are supported.'
    if (file.size > 50 * 1024 * 1024) return 'File too large (max 50 MB).'
    return null
  }

  async function startWithFile(file: File) {
    const err = validateFile(file)
    if (err) { setFileError(err); return }
    setFileError(null)
    setDataSource('csv')
    setPhase('running')
    try {
      const { job_id } = await apiPostFile<{ job_id: string }>('/upload/file', file)
      setJobId(job_id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Upload failed'
      setPhase('error')
      setPipelineStatus({ stage: 0, status: 'error', message: '', error: msg })
    }
  }

  async function startWithSample() {
    setDataSource('sample')
    setPhase('running')
    try {
      const { job_id } = await apiPostJSON<{ job_id: string }>('/upload/sample')
      setJobId(job_id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Request failed'
      setPhase('error')
      setPipelineStatus({ stage: 0, status: 'error', message: '', error: msg })
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) startWithFile(file)
  }

  function handleReset() {
    setPhase('idle')
    setJobId(null)
    setPipelineStatus(null)
    setFileError(null)
    setDataSource(null)
  }

  const progress = ((pipelineStage + 1) / 11) * 100

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-screen-xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">{t('upload.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('upload.subtitle')}</p>
      </div>

      {/* ── IDLE ────────────────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-4',
              'cursor-pointer transition-all duration-200 min-h-[280px] select-none outline-none',
              isDragging
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border hover:border-primary/50 hover:bg-muted/30',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) startWithFile(f) }}
            />
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <FileUp className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">{t('upload.dropzone')}</p>
              <p className="text-sm text-muted-foreground mt-1">CSV · max 50 MB</p>
            </div>
            <div className="w-full text-[10px] text-muted-foreground border border-border rounded-lg px-3 py-2 bg-muted/20 text-center leading-loose">
              <span className="font-medium">{t('upload.required')}</span>
              <br />
              {REQUIRED_COLS.join(' · ')}
            </div>
            {fileError && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fileError}
              </p>
            )}
          </div>

          {/* Sample data card */}
          <div className="border border-border rounded-2xl p-8 flex flex-col justify-between gap-6 min-h-[280px] bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex flex-col gap-3">
              <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Database className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold">{t('upload.sampleBtn')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('upload.sampleDesc')}</p>
              <div className="flex gap-2 flex-wrap">
                {['541,909 筆交易', '4,338 位客戶', '3,665 件商品'].map(tag => (
                  <span
                    key={tag}
                    className="text-[11px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={startWithSample}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {t('upload.sampleBtn')}
            </button>
          </div>
        </div>
      )}

      {/* ── RUNNING ─────────────────────────────────────────────────────── */}
      {phase === 'running' && (
        <div className="border border-border rounded-2xl bg-card shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-border">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
              <span className="font-semibold text-sm text-amber-700 dark:text-amber-400">
                {t('upload.running')}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {dataSource === 'sample' ? 'UCI Sample Dataset' : 'Custom CSV'}
            </span>
          </div>

          {/* Two-column body: stepper + animation */}
          <div className="flex min-h-[380px]">
            {/* Left: step list */}
            <div className="w-[220px] shrink-0 border-r border-border/60 bg-muted/10 py-2 px-1.5 flex flex-col gap-0.5 overflow-y-auto">
              {STAGE_NAMES.map((name, i) => {
                const isDone    = pipelineStage > i
                const isRunning = pipelineStage === i
                const Icon      = STAGE_ICONS[i]
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all duration-300',
                      isRunning ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium' :
                      isDone    ? 'text-muted-foreground/60' :
                                  'text-muted-foreground/35',
                    )}
                  >
                    <span className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all',
                      isDone    ? 'bg-green-100 dark:bg-green-900/30 text-green-600' :
                      isRunning ? 'bg-amber-500 text-white shadow-sm' :
                                  'bg-muted/60 text-muted-foreground/40',
                    )}>
                      {isDone    ? <CheckCircle2 className="w-3 h-3" /> :
                       isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> :
                                   <Icon className="w-3 h-3" />}
                    </span>
                    <span className="leading-tight truncate">{name}</span>
                  </div>
                )
              })}
            </div>

            {/* Right: journey animation */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <div className="px-4 pt-3 pb-1 shrink-0">
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wide">
                  {STAGE_NAMES[pipelineStage]}
                </p>
                <h3 className="text-sm font-bold text-foreground leading-tight mt-0.5">
                  {journeyStage?.title ?? ''}
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  {journeyStage?.subtitle ?? ''}
                </p>
              </div>

              {/* Render stage animation — key forces fresh mount on each stage */}
              <div className="flex-1 flex items-center justify-center px-4 py-2 overflow-hidden">
                <div className="w-full max-h-[220px]">
                  <StageComp key={pipelineStage} active={true} />
                </div>
              </div>

              <div className="px-4 pb-3 shrink-0">
                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-3">
                  {journeyStage?.description ?? ''}
                </p>
              </div>
            </div>
          </div>

          {/* Footer: progress bar */}
          <div className="px-5 py-3 border-t border-border bg-muted/10">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>{pipelineStatus?.message ?? '…'}</span>
              <span className="font-medium tabular-nums">{pipelineStage + 1} / 11</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── DONE ────────────────────────────────────────────────────────── */}
      {phase === 'done' && (
        <div className="border border-green-200 dark:border-green-800 rounded-2xl p-10 bg-green-50/50 dark:bg-green-950/20 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-green-700 dark:text-green-400">
              {t('upload.done')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              {countdown > 0 ? `${countdown} ${t('upload.redirecting')}` : '正在跳轉…'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { sessionStorage.setItem('retailpulse:autoGuide', '1'); router.push('/') }}
              className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              {t('upload.goToDashboard')}
            </button>
            <button
              onClick={handleReset}
              className="px-5 py-2.5 rounded-xl border border-border text-sm hover:bg-muted/50 transition-colors"
            >
              {t('upload.reupload')}
            </button>
          </div>
        </div>
      )}

      {/* ── ERROR ───────────────────────────────────────────────────────── */}
      {phase === 'error' && (
        <div className="border border-destructive/30 rounded-2xl p-10 bg-destructive/5 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-destructive">{t('upload.error')}</h2>
            {pipelineStatus?.error && (
              <p className="text-xs text-muted-foreground mt-2 font-mono max-w-[440px] break-all leading-relaxed">
                {pipelineStatus.error}
              </p>
            )}
          </div>
          <button
            onClick={handleReset}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            {t('upload.retry')}
          </button>
        </div>
      )}
    </div>
  )
}
