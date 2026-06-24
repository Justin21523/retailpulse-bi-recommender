'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Brain, X, ChevronLeft, ChevronRight, Play, Pause,
  LayoutDashboard, Users, CalendarDays, ShoppingCart, Sparkles, TrendingUp, FlaskConical,
} from 'lucide-react'
import { PAGE_TOURS, type TourStep } from '@/lib/tourSteps'
import { SpotlightDecorator } from '@/components/journey/SpotlightDecorator'
import { cn } from '@/lib/utils'
import { useI18n } from '@/contexts/I18nContext'

// ---------------------------------------------------------------------------
// Static data — built once at module level
// ---------------------------------------------------------------------------
type ExtendedStep = TourStep & { path: string }

const ALL_STEPS: ExtendedStep[] = Object.entries(PAGE_TOURS).flatMap(
  ([path, steps]) => steps.map(s => ({ ...s, path }))
)

const PAGE_DEFS = [
  { path: '/',                icon: LayoutDashboard, navKey: 'nav.dashboard' },
  { path: '/customers',       icon: Users,           navKey: 'nav.customers' },
  { path: '/cohort',          icon: CalendarDays,    navKey: 'nav.cohort' },
  { path: '/basket',          icon: ShoppingCart,    navKey: 'nav.basket' },
  { path: '/recommendations', icon: Sparkles,        navKey: 'nav.recommendations' },
  { path: '/forecast',        icon: TrendingUp,      navKey: 'nav.forecast' },
  { path: '/ml-insights',     icon: Brain,           navKey: 'nav.mlInsights' },
  { path: '/ab-testing',      icon: FlaskConical,    navKey: 'nav.abTesting' },
]

let _si = 0
const PAGE_GROUPS = PAGE_DEFS.map(def => {
  const stepCount = (PAGE_TOURS[def.path] ?? []).length
  const startIdx = _si
  _si += stepCount
  return { ...def, startIdx, stepCount }
})

const PAGE_TO_STAGE: Record<string, string> = {
  '/': 'insights',
  '/customers': 'rfm',
  '/cohort': 'cohort',
  '/basket': 'basket',
  '/recommendations': 'recommendations',
  '/forecast': 'forecast',
  '/ml-insights': 'churn',
  '/ab-testing': 'ab-test',
}

const RING_R    = 7
const RING_CIRC = 2 * Math.PI * RING_R

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AppGuide() {
  const pathname = usePathname()
  const router   = useRouter()
  const { t }    = useI18n()

  const [isOpen,    setIsOpen]    = useState(false)
  const [stepIdx,   setStepIdx]   = useState(0)
  const [pendingIdx, setPendingIdx] = useState<number | null>(null)
  const [playing,   setPlaying]   = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [decoratorTarget, setDecoratorTarget] = useState<Element | null>(null)

  const prevElRef          = useRef<Element | null>(null)
  const decoratorTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stepRef            = useRef(stepIdx)
  useEffect(() => { stepRef.current = stepIdx }, [stepIdx])

  const current = ALL_STEPS[stepIdx]
  const stageId = PAGE_TO_STAGE[current?.path ?? '/'] ?? 'insights'

  // ── Highlight helper ────────────────────────────────────────────────────
  const executeHighlight = useCallback((step: ExtendedStep) => {
    if (prevElRef.current) {
      prevElRef.current.classList.remove('spotlight-target-primary')
      prevElRef.current = null
    }
    const el = document.querySelector(step.selector)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('spotlight-target-primary')
    prevElRef.current = el
    setDecoratorTarget(el)
    if (decoratorTimerRef.current) clearTimeout(decoratorTimerRef.current)
    decoratorTimerRef.current = setTimeout(() => {
      if (prevElRef.current) {
        prevElRef.current.classList.remove('spotlight-target-primary')
        prevElRef.current = null
      }
      setDecoratorTarget(null)
    }, 3500)
  }, [])

  // ── Navigation ──────────────────────────────────────────────────────────
  const jumpToStep = useCallback((idx: number) => {
    const step = ALL_STEPS[idx]
    if (!step) return
    setStepIdx(idx)
    if (pathname !== step.path) {
      setPendingIdx(idx)
      router.push(step.path)
    } else {
      setTimeout(() => executeHighlight(step), 100)
    }
  }, [pathname, router, executeHighlight])

  // Clear highlight when route changes (planned or external)
  useEffect(() => {
    if (!isOpen) return
    if (prevElRef.current) {
      prevElRef.current.classList.remove('spotlight-target-primary')
      prevElRef.current = null
    }
    setDecoratorTarget(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Execute pending highlight once the target page is loaded
  useEffect(() => {
    if (pendingIdx === null || !isOpen) return
    const step = ALL_STEPS[pendingIdx]
    if (pathname === step?.path) {
      setTimeout(() => {
        executeHighlight(step)
        setPendingIdx(null)
      }, 600)
    }
  }, [pathname, pendingIdx, isOpen, executeHighlight])

  // ── Auto-play ───────────────────────────────────────────────────────────
  useEffect(() => {
    setCountdown(5)
    if (!playing || !isOpen) return
    let c = 5
    const iv = setInterval(() => {
      c--
      setCountdown(c)
      if (c <= 0) {
        clearInterval(iv)
        const next = stepRef.current + 1
        if (next < ALL_STEPS.length) {
          jumpToStep(next)
        } else {
          setPlaying(false)
        }
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [playing, isOpen, stepIdx, jumpToStep])

  // ── Lifecycle ───────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (prevElRef.current) prevElRef.current.classList.remove('spotlight-target-primary')
      if (decoratorTimerRef.current) clearTimeout(decoratorTimerRef.current)
    }
  }, [])

  // ── Auto-open on every visit ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('retailpulse:disableAutoGuide') === '1') return
    const timer = setTimeout(() => {
      setIsOpen(true)
      setStepIdx(0)
      setCountdown(5)
      setTimeout(() => executeHighlight(ALL_STEPS[0]), 150)
      setPlaying(true)
    }, 1200)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-open after pipeline completion (sessionStorage trigger) ─────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('retailpulse:disableAutoGuide') === '1') return
    const flag = sessionStorage.getItem('retailpulse:autoGuide')
    if (flag !== '1') return
    sessionStorage.removeItem('retailpulse:autoGuide')
    const timer = setTimeout(() => {
      setIsOpen(true)
      setStepIdx(0)
      setCountdown(5)
      setTimeout(() => executeHighlight(ALL_STEPS[0]), 150)
      setPlaying(true)
    }, 800)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Actions ─────────────────────────────────────────────────────────────
  function open() {
    setIsOpen(true)
    setStepIdx(0)
    setPlaying(false)
    setCountdown(5)
    setTimeout(() => executeHighlight(ALL_STEPS[0]), 150)
  }

  function close() {
    setIsOpen(false)
    setPlaying(false)
    setPendingIdx(null)
    setDecoratorTarget(null)
    if (prevElRef.current) {
      prevElRef.current.classList.remove('spotlight-target-primary')
      prevElRef.current = null
    }
    if (decoratorTimerRef.current) clearTimeout(decoratorTimerRef.current)
  }

  const handlePrev = () => {
    setPlaying(false)
    if (stepIdx > 0) jumpToStep(stepIdx - 1)
  }

  const handleNext = () => {
    setPlaying(false)
    if (stepIdx < ALL_STEPS.length - 1) jumpToStep(stepIdx + 1)
    else close()
  }

  const togglePlay = () => {
    if (playing) { setPlaying(false); setCountdown(5) }
    else setPlaying(true)
  }

  const progress = ((stepIdx + 1) / ALL_STEPS.length) * 100

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Spotlight decorator layer */}
      {isOpen && (
        <SpotlightDecorator targetEl={decoratorTarget} stageId={stageId} active={decoratorTarget !== null} />
      )}

      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/65 z-40 transition-opacity duration-300" onClick={close} />
      )}

      {/* Trigger button */}
      {!isOpen && (
        <button
          onClick={open}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all duration-200"
        >
          <Brain className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium whitespace-nowrap">
            {t('tour.guide.title')} ({ALL_STEPS.length})
          </span>
        </button>
      )}

      {/* Main card */}
      {isOpen && current && (
        <div
          className="fixed bottom-6 right-6 z-50 w-[460px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[calc(100vh-3rem)]"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-bold text-foreground">{t('tour.guide.title')}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{stepIdx + 1} / {ALL_STEPS.length}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Auto-play toggle */}
              <button
                onClick={togglePlay}
                title={t('tour.guide.autoplay')}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                  playing
                    ? 'bg-primary/15 text-primary hover:bg-primary/25'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {playing ? (
                  <>
                    <svg width={16} height={16} className="-rotate-90 block">
                      <circle cx={8} cy={8} r={RING_R} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={2} />
                      <circle
                        cx={8} cy={8} r={RING_R}
                        fill="none" stroke="currentColor" strokeWidth={2}
                        strokeDasharray={RING_CIRC}
                        strokeDashoffset={RING_CIRC * (1 - countdown / 5)}
                        style={{ transition: 'stroke-dashoffset 1s linear' }}
                      />
                    </svg>
                    <Pause className="w-3 h-3" />
                    <span>{countdown}s</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    <span>{t('tour.guide.autoplay')}</span>
                  </>
                )}
              </button>
              <button
                onClick={close}
                className="rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left sidebar: page groups */}
            <div className="w-[110px] shrink-0 border-r border-border/60 bg-muted/20 py-2 px-1.5 flex flex-col gap-0.5 overflow-y-auto">
              {PAGE_GROUPS.map(pg => {
                const Icon     = pg.icon
                const isActive = stepIdx >= pg.startIdx && stepIdx < pg.startIdx + pg.stepCount
                return (
                  <button
                    key={pg.path}
                    onClick={() => jumpToStep(pg.startIdx)}
                    className={cn(
                      'flex items-center gap-1.5 w-full px-1.5 py-1.5 rounded-lg text-left transition-all duration-200',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/40'
                    )}
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    <span className="text-[9px] font-medium flex-1 truncate leading-tight">{t(pg.navKey)}</span>
                    <span className={cn(
                      'text-[8px] font-bold px-1 py-0.5 rounded-full shrink-0 min-w-[14px] text-center',
                      isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    )}>
                      {pg.stepCount}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Right: step content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <div className="px-3 pt-3 pb-1.5 shrink-0">
                {/* Page path + local step counter */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                    {current.path}
                  </span>
                  {(() => {
                    const pg = PAGE_GROUPS.find(p => p.path === current.path)
                    if (!pg) return null
                    const local = stepIdx - pg.startIdx + 1
                    return (
                      <span className="text-[9px] text-muted-foreground">{local} / {pg.stepCount}</span>
                    )
                  })()}
                </div>
                <h3 className="text-sm font-bold text-foreground leading-tight">{current.title}</h3>
              </div>

              {/* Step content */}
              <div className="px-3 py-2 flex-1 overflow-y-auto">
                <p className="text-[10px] text-muted-foreground leading-relaxed">{current.content}</p>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="shrink-0 border-t border-border px-4 pt-2 pb-3">
            {/* Progress bar */}
            <div className="h-0.5 bg-muted rounded-full overflow-hidden mb-2.5">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={stepIdx === 0}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3 h-3" />
                {t('tour.guide.prev')}
              </button>

              {/* Page-level dots (8 dots for 8 pages) */}
              <div className="flex-1 flex justify-center gap-1.5">
                {PAGE_GROUPS.map((pg, i) => {
                  const done   = stepIdx >= pg.startIdx + pg.stepCount
                  const active = stepIdx >= pg.startIdx && stepIdx < pg.startIdx + pg.stepCount
                  return (
                    <button
                      key={i}
                      onClick={() => jumpToStep(pg.startIdx)}
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-200',
                        active ? 'bg-primary w-4' : done ? 'bg-primary/40 w-1.5' : 'bg-muted w-1.5'
                      )}
                    />
                  )
                })}
              </div>

              {stepIdx < ALL_STEPS.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors"
                >
                  {t('tour.guide.next')}
                  <ChevronRight className="w-3 h-3" />
                </button>
              ) : (
                <button
                  onClick={close}
                  className="text-xs px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors"
                >
                  {t('tour.guide.done')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
