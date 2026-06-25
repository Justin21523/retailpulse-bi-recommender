'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sparkles, X, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { JOURNEY_STAGES } from '@/lib/journeyStages'
import { SpotlightDecorator } from './SpotlightDecorator'
import { RawDataStage } from './stages/RawDataStage'
import { CleaningStage } from './stages/CleaningStage'
import { RFMStage } from './stages/RFMStage'
import { SegmentStage } from './stages/SegmentStage'
import { CohortStage } from './stages/CohortStage'
import { BasketStage } from './stages/BasketStage'
import { ChurnStage } from './stages/ChurnStage'
import { ForecastStage } from './stages/ForecastStage'
import { RecommendationStage } from './stages/RecommendationStage'
import { ABStage } from './stages/ABStage'
import { InsightStage } from './stages/InsightStage'
import { appPathname, navigateToPublicPath } from '@/lib/paths'

const STAGE_COMPONENTS = [
  RawDataStage, CleaningStage, RFMStage, SegmentStage,
  CohortStage, BasketStage, ChurnStage, ForecastStage,
  RecommendationStage, ABStage, InsightStage,
]

export function DataJourneyPanel() {
  const pathname = appPathname(usePathname())
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [pendingScroll, setPendingScroll] = useState(false)
  const [decoratorTarget, setDecoratorTarget] = useState<Element | null>(null)
  const decoratorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const current = JOURNEY_STAGES[step]
  const StageComp = STAGE_COMPONENTS[step]

  const scrollToAndHighlight = useCallback((selector: string) => {
    const el = document.querySelector(selector)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('spotlight-target')
    setDecoratorTarget(el)
    if (decoratorTimerRef.current) clearTimeout(decoratorTimerRef.current)
    decoratorTimerRef.current = setTimeout(() => {
      el.classList.remove('spotlight-target')
      setDecoratorTarget(null)
    }, 3500)
  }, [])

  useEffect(() => {
    return () => {
      if (decoratorTimerRef.current) clearTimeout(decoratorTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!pendingScroll || !isOpen) return
    if (pathname === current.path) {
      setTimeout(() => {
        scrollToAndHighlight(current.selector)
        setPendingScroll(false)
      }, 600)
    }
  }, [pathname, pendingScroll, isOpen, current, scrollToAndHighlight])

  const goToStep = useCallback((idx: number) => {
    setStep(idx)
    const stage = JOURNEY_STAGES[idx]
    if (pathname !== stage.path) {
      setPendingScroll(true)
      if (!navigateToPublicPath(stage.path)) router.push(stage.path)
    } else {
      setTimeout(() => scrollToAndHighlight(stage.selector), 100)
    }
  }, [pathname, router, scrollToAndHighlight])

  function handleOpen() {
    setIsOpen(true)
    goToStep(0)
  }

  function handleClose() {
    setIsOpen(false)
    setPendingScroll(false)
    setDecoratorTarget(null)
    if (decoratorTimerRef.current) clearTimeout(decoratorTimerRef.current)
  }

  function handleNext() {
    if (step < JOURNEY_STAGES.length - 1) goToStep(step + 1)
  }

  function handlePrev() {
    if (step > 0) goToStep(step - 1)
  }

  const progress = ((step + 1) / JOURNEY_STAGES.length) * 100

  return (
    <>
      {/* Spotlight decorators — rendered at z-65 above panel */}
      {isOpen && (
        <SpotlightDecorator
          targetEl={decoratorTarget}
          stageId={current.id}
          active={decoratorTarget !== null}
        />
      )}

      {/* Trigger button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-36 z-50 flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-2 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5" />
          資料旅程
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/65 z-40 transition-opacity duration-300"
            onClick={handleClose}
          />

          {/* Floating card — 460px wide, two-column layout */}
          <div className="fixed bottom-6 right-6 z-50 w-[460px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[calc(100vh-3rem)]">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-amber-50 dark:bg-amber-950/30 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-bold text-foreground">資料旅程</span>
                <span className="text-xs text-muted-foreground">{step + 1} / {JOURNEY_STAGES.length}</span>
              </div>
              <button
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body: left sidebar + right content */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

              {/* Left sidebar — stage index list */}
              <div className="w-[118px] shrink-0 border-r border-border/60 bg-muted/20 py-2 px-1.5 flex flex-col gap-0.5 overflow-y-auto">
                {JOURNEY_STAGES.map((stage, i) => (
                  <button
                    key={stage.id}
                    onClick={() => goToStep(i)}
                    className={cn(
                      'flex items-center gap-1.5 w-full px-1.5 py-1.5 rounded-lg text-left transition-all duration-200',
                      i === step
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        : i < step
                        ? 'text-muted-foreground/70 hover:bg-muted/40'
                        : 'text-muted-foreground/40 hover:bg-muted/20'
                    )}
                  >
                    <span
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 transition-all',
                        i < step
                          ? 'bg-amber-400/25 text-amber-600'
                          : i === step
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-muted/60 text-muted-foreground/50'
                      )}
                    >
                      {i < step ? '✓' : i + 1}
                    </span>
                    <span className="text-[9px] leading-tight line-clamp-2">{stage.title}</span>
                  </button>
                ))}
              </div>

              {/* Right content panel */}
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                {/* Stage title + subtitle */}
                <div className="px-3 pt-2.5 pb-1 shrink-0">
                  <h3 className="text-sm font-bold text-foreground leading-tight">{current.title}</h3>
                  <p className="text-[10px] text-amber-600 font-medium mt-0.5 leading-tight">{current.subtitle}</p>
                </div>

                {/* Animation zone — larger than before */}
                <div className="px-3 py-2 min-h-[200px] flex items-center">
                  <StageComp active={isOpen} />
                </div>

                {/* Description */}
                <div className="px-3 pb-2 shrink-0">
                  <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-3">
                    {current.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer: progress + navigation */}
            <div className="shrink-0 border-t border-border px-4 pt-2 pb-3">
              {/* Progress bar */}
              <div className="h-0.5 bg-muted rounded-full overflow-hidden mb-2.5">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-400"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  disabled={step === 0}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3 h-3" />
                  上一步
                </button>

                {/* Step dots */}
                <div className="flex-1 flex justify-center gap-1.5">
                  {JOURNEY_STAGES.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goToStep(i)}
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-200',
                        i === step ? 'bg-amber-500 w-4' : i < step ? 'bg-amber-300 w-1.5' : 'bg-muted w-1.5'
                      )}
                    />
                  ))}
                </div>

                {step < JOURNEY_STAGES.length - 1 ? (
                  <button
                    onClick={handleNext}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors"
                  >
                    下一步
                    <ChevronRight className="w-3 h-3" />
                  </button>
                ) : (
                  <button
                    onClick={handleClose}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    完成旅程
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
