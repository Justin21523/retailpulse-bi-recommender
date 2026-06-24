'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Brain, X, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import { PAGE_TOURS, type TourStep } from '@/lib/tourSteps'
import { cn } from '@/lib/utils'

interface TooltipPosition {
  top: number
  left: number
  transformOrigin: string
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

function calcPosition(rect: DOMRect, placement: TourStep['placement'], cardW = 300, cardH = 180): TooltipPosition {
  const gap = 16
  const vw = window.innerWidth
  const vh = window.innerHeight

  let top = 0
  let left = 0
  let transformOrigin = 'top left'

  switch (placement) {
    case 'bottom':
      top = rect.bottom + gap
      left = rect.left + rect.width / 2 - cardW / 2
      transformOrigin = 'top center'
      break
    case 'top':
      top = rect.top - cardH - gap
      left = rect.left + rect.width / 2 - cardW / 2
      transformOrigin = 'bottom center'
      break
    case 'right':
      top = rect.top + rect.height / 2 - cardH / 2
      left = rect.right + gap
      transformOrigin = 'center left'
      break
    case 'left':
      top = rect.top + rect.height / 2 - cardH / 2
      left = rect.left - cardW - gap
      transformOrigin = 'center right'
      break
  }

  // Clamp within viewport with padding
  top = clamp(top, 8, vh - cardH - 8)
  left = clamp(left, 8, vw - cardW - 8)

  return { top, left, transformOrigin }
}

export function FloatingTourGuide() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [pos, setPos] = useState<TooltipPosition | null>(null)
  const prevElRef = useRef<Element | null>(null)

  const steps = PAGE_TOURS[pathname] ?? []
  const current = steps[step]
  const hasSteps = steps.length > 0

  // Reset when navigating to a new page
  useEffect(() => {
    setIsOpen(false)
    setStep(0)
    setPos(null)
  }, [pathname])

  const highlight = useCallback((el: Element | null, stepData: TourStep | undefined) => {
    // Remove highlight from previous element
    if (prevElRef.current) {
      prevElRef.current.classList.remove('spotlight-target-primary')
      prevElRef.current = null
    }
    if (!el || !stepData) return

    el.classList.add('spotlight-target-primary')
    prevElRef.current = el

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })

    // Wait for scroll to settle, then compute tooltip position
    setTimeout(() => {
      const rect = el.getBoundingClientRect()
      setPos(calcPosition(rect, stepData.placement))
    }, 350)
  }, [])

  // Handle step changes
  useEffect(() => {
    if (!isOpen || !current) {
      if (prevElRef.current) {
        prevElRef.current.classList.remove('spotlight-target-primary')
        prevElRef.current = null
      }
      return
    }

    const el = document.querySelector(current.selector)
    highlight(el, current)
  }, [step, isOpen, current, highlight])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (prevElRef.current) {
        prevElRef.current.classList.remove('spotlight-target-primary')
      }
    }
  }, [])

  const open = () => {
    setStep(0)
    setIsOpen(true)
  }

  const close = () => {
    setIsOpen(false)
    setPos(null)
    if (prevElRef.current) {
      prevElRef.current.classList.remove('spotlight-target-primary')
      prevElRef.current = null
    }
  }

  const prev = () => setStep((s) => Math.max(0, s - 1))
  const next = () => {
    if (step < steps.length - 1) {
      setStep((s) => s + 1)
    } else {
      close()
    }
  }

  if (!hasSteps) return null

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/65 z-40 transition-opacity duration-300"
          onClick={close}
        />
      )}

      {/* Floating Tooltip Card */}
      {isOpen && current && pos && (
        <div
          className="fixed z-[60] w-[300px] rounded-xl border border-border bg-background shadow-xl animate-in fade-in zoom-in-95 duration-200"
          style={{ top: pos.top, left: pos.left, transformOrigin: pos.transformOrigin }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-semibold truncate">{current.title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground tabular-nums">{step + 1}/{steps.length}</span>
              <button
                onClick={close}
                className="rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="關閉導覽"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Step indicator dots */}
          <div className="flex gap-1 px-4 pt-2">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cn(
                  'h-1 rounded-full transition-all duration-200',
                  i === step ? 'bg-primary w-4' : 'bg-muted w-1.5 hover:bg-muted-foreground'
                )}
              />
            ))}
          </div>

          {/* Content */}
          <div className="px-4 py-3">
            <p className="text-xs text-muted-foreground leading-relaxed">{current.content}</p>
          </div>

          {/* Footer navigation */}
          <div className="flex items-center justify-between px-4 pb-3">
            <button
              onClick={prev}
              disabled={step === 0}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              上一步
            </button>
            <button
              onClick={next}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              {step === steps.length - 1 ? '完成' : '下一步'}
              {step < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        onClick={isOpen ? close : open}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full shadow-lg transition-all duration-200',
          isOpen
            ? 'bg-muted text-muted-foreground px-3 py-2 border border-border hover:bg-muted/80'
            : 'bg-primary text-primary-foreground px-4 py-2 hover:bg-primary/90 hover:scale-105 active:scale-95',
        )}
        aria-label="功能導覽"
      >
        <Brain className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium whitespace-nowrap">
          {isOpen ? '關閉導覽' : `導覽 (${steps.length})`}
        </span>
      </button>
    </>
  )
}
