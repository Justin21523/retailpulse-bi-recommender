'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

// 用原生 input[type=range] 包裝，API 與 Radix UI Slider 相容
interface SliderProps {
  value?: number[]
  defaultValue?: number[]
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number[]) => void
  className?: string
  disabled?: boolean
}

function Slider({
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  className,
  disabled = false,
}: SliderProps) {
  const currentVal = (value ?? defaultValue ?? [min])[0]

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={currentVal}
      disabled={disabled}
      onChange={(e) => onValueChange?.([parseFloat(e.target.value)])}
      className={cn(
        'w-full h-2 rounded-full appearance-none cursor-pointer',
        'bg-muted accent-primary',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    />
  )
}

export { Slider }
