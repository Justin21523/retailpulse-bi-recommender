'use client'

import { useEffect, useState } from 'react'

interface Particle {
  id: number
  offsetX: number
  offsetY: number
  delay: number
  content: string
  duration: number
  color?: string
}

const DECORATORS: Record<string, Particle[]> = {
  'raw-data': [
    { id: 1, offsetX: -95, offsetY: -28, delay: 0,   duration: 2800, content: 'StockCode · Qty · Price' },
    { id: 2, offsetX: 85,  offsetY: -32, delay: 300,  duration: 2500, content: '541,909 rows' },
    { id: 3, offsetX: -60, offsetY:  48, delay: 600,  duration: 2200, content: '🗄 raw CSV' },
    { id: 4, offsetX: 100, offsetY:  38, delay: 200,  duration: 2600, content: 'InvoiceDate ▸' },
    { id: 5, offsetX: 30,  offsetY: -50, delay: 450,  duration: 2300, content: '25,900 invoices' },
  ],
  'cleaning': [
    { id: 1, offsetX: -88, offsetY: -28, delay: 0,   duration: 2800, content: '✕ -9,288', color: 'red' },
    { id: 2, offsetX: 92,  offsetY: -22, delay: 400,  duration: 2400, content: '✕ -135,080', color: 'red' },
    { id: 3, offsetX: -58, offsetY:  48, delay: 700,  duration: 2200, content: '✓ 397,924 kept', color: 'green' },
    { id: 4, offsetX: 78,  offsetY:  42, delay: 200,  duration: 2600, content: '-27% removed' },
    { id: 5, offsetX: 20,  offsetY: -50, delay: 500,  duration: 2300, content: '✕ -2,515' , color: 'red' },
  ],
  'rfm': [
    { id: 1, offsetX: -88, offsetY: -28, delay: 0,   duration: 2800, content: 'R = 19 天' },
    { id: 2, offsetX: 88,  offsetY: -22, delay: 350,  duration: 2500, content: 'F = 7 次' },
    { id: 3, offsetX: -58, offsetY:  48, delay: 700,  duration: 2200, content: 'M = £4,310' },
    { id: 4, offsetX: 82,  offsetY:  42, delay: 150,  duration: 2700, content: 'Score 4-4-4', color: 'primary' },
    { id: 5, offsetX: -20, offsetY: -50, delay: 500,  duration: 2300, content: 'Champions ★' },
  ],
  'segmentation': [
    { id: 1, offsetX: -92, offsetY: -28, delay: 0,   duration: 2800, content: '🟢 Champions' },
    { id: 2, offsetX: 88,  offsetY: -32, delay: 300,  duration: 2500, content: '🔵 Loyal' },
    { id: 3, offsetX: -58, offsetY:  50, delay: 600,  duration: 2200, content: '🟡 At Risk' },
    { id: 4, offsetX: 82,  offsetY:  45, delay: 200,  duration: 2600, content: '🔴 Lost' },
    { id: 5, offsetX: 10,  offsetY: -52, delay: 400,  duration: 2300, content: 'K-Means K=4' },
  ],
  'cohort': [
    { id: 1, offsetX: -90, offsetY: -28, delay: 0,   duration: 2800, content: 'M1: 23% kept', color: 'primary' },
    { id: 2, offsetX:  88, offsetY: -24, delay: 300,  duration: 2500, content: 'M6: 8% ↓',    color: 'red' },
    { id: 3, offsetX: -55, offsetY:  50, delay: 600,  duration: 2200, content: '12 月同期群' },
    { id: 4, offsetX:  78, offsetY:  44, delay: 200,  duration: 2600, content: '留存衰減曲線' },
    { id: 5, offsetX:  15, offsetY: -52, delay: 450,  duration: 2300, content: 'Cohort Analysis' },
  ],
  'basket': [
    { id: 1, offsetX: -88, offsetY: -28, delay: 0,   duration: 2800, content: 'lift = 3.2×',  color: 'green' },
    { id: 2, offsetX:  90, offsetY: -22, delay: 300,  duration: 2500, content: 'conf = 70%' },
    { id: 3, offsetX: -55, offsetY:  50, delay: 600,  duration: 2200, content: '88 條規則',   color: 'primary' },
    { id: 4, offsetX:  78, offsetY:  44, delay: 200,  duration: 2600, content: 'Apriori ▸' },
    { id: 5, offsetX:  12, offsetY: -52, delay: 450,  duration: 2300, content: 'support=0.02' },
  ],
  'recommendations': [
    { id: 1, offsetX: -88, offsetY: -28, delay: 0,   duration: 2800, content: 'CF 協作過濾',    color: 'primary' },
    { id: 2, offsetX:  90, offsetY: -22, delay: 300,  duration: 2500, content: 'Thompson Bandit' },
    { id: 3, offsetX: -55, offsetY:  50, delay: 600,  duration: 2200, content: '+60% CTR',       color: 'green' },
    { id: 4, offsetX:  78, offsetY:  44, delay: 200,  duration: 2600, content: 'Top-10 推薦' },
    { id: 5, offsetX:  12, offsetY: -52, delay: 450,  duration: 2300, content: '即時學習 ▸' },
  ],
  'churn': [
    { id: 1, offsetX: -88, offsetY: -28, delay: 0,   duration: 2800, content: '⚠ 78% churn risk', color: 'red' },
    { id: 2, offsetX: 92,  offsetY: -22, delay: 300,  duration: 2500, content: 'AUC-ROC > 0.85', color: 'primary' },
    { id: 3, offsetX: -58, offsetY:  48, delay: 600,  duration: 2200, content: 'MLP · 5 layers' },
    { id: 4, offsetX: 78,  offsetY:  42, delay: 200,  duration: 2600, content: '180 天預測視窗' },
    { id: 5, offsetX: 15,  offsetY: -52, delay: 450,  duration: 2300, content: 'High Risk →' },
  ],
  'forecast': [
    { id: 1, offsetX: -90, offsetY: -28, delay: 0,   duration: 2800, content: '↗ SARIMA trend' },
    { id: 2, offsetX: 88,  offsetY: -30, delay: 300,  duration: 2500, content: '📅 7–30 天窗口' },
    { id: 3, offsetX: -55, offsetY:  50, delay: 600,  duration: 2200, content: 'ETS · LSTM', color: 'primary' },
    { id: 4, offsetX: 82,  offsetY:  42, delay: 200,  duration: 2600, content: '信賴區間 ±12%' },
    { id: 5, offsetX: 20,  offsetY: -52, delay: 450,  duration: 2300, content: 'MAPE 分析 →' },
  ],
  'ab-test': [
    { id: 1, offsetX: -88, offsetY: -28, delay: 0,   duration: 2800, content: 'A: 5.0% conv.' },
    { id: 2, offsetX: 88,  offsetY: -22, delay: 300,  duration: 2500, content: 'B: 8.0% ✓', color: 'green' },
    { id: 3, offsetX: -55, offsetY:  48, delay: 600,  duration: 2200, content: 'p < 0.05 ★', color: 'green' },
    { id: 4, offsetX: 78,  offsetY:  42, delay: 200,  duration: 2600, content: 'lift +60%', color: 'green' },
    { id: 5, offsetX: 15,  offsetY: -52, delay: 450,  duration: 2300, content: 'Z-test 驗證' },
  ],
  'insights': [
    { id: 1, offsetX: -88, offsetY: -28, delay: 0,   duration: 2800, content: '✦ £8.9M revenue' },
    { id: 2, offsetX: 90,  offsetY: -25, delay: 300,  duration: 2500, content: '✦ 4,338 customers' },
    { id: 3, offsetX: -58, offsetY:  50, delay: 600,  duration: 2200, content: '✦ 11 models' },
    { id: 4, offsetX: 78,  offsetY:  45, delay: 200,  duration: 2600, content: '✦ 88 rules' },
    { id: 5, offsetX: 15,  offsetY: -52, delay: 450,  duration: 2300, content: '✦ Pipeline ready' },
  ],
}

const COLOR_STYLES: Record<string, string> = {
  red:     'text-red-700 dark:text-red-400 bg-red-50/90 dark:bg-red-950/80 border-red-300/60 dark:border-red-700/60',
  green:   'text-green-700 dark:text-green-400 bg-green-50/90 dark:bg-green-950/80 border-green-300/60 dark:border-green-700/60',
  primary: 'text-blue-700 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/80 border-blue-300/60 dark:border-blue-700/60',
}
const DEFAULT_STYLE = 'text-amber-700 dark:text-amber-400 bg-amber-50/90 dark:bg-amber-950/80 border-amber-300/60 dark:border-amber-700/60'

interface SpotlightDecoratorProps {
  targetEl: Element | null
  stageId: string
  active: boolean
}

export function SpotlightDecorator({ targetEl, stageId, active }: SpotlightDecoratorProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (active && targetEl) {
      // Let scroll settle before computing rect
      const t = setTimeout(() => {
        setRect(targetEl.getBoundingClientRect())
        setVisible(true)
      }, 450)
      return () => clearTimeout(t)
    } else {
      setVisible(false)
      setRect(null)
    }
  }, [active, targetEl])

  if (!visible || !rect) return null

  const particles = DECORATORS[stageId] ?? []
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  return (
    <>
      {particles.map((p) => {
        const colorClass = p.color ? (COLOR_STYLES[p.color] ?? DEFAULT_STYLE) : DEFAULT_STYLE
        return (
          <div
            key={p.id}
            style={{
              position: 'fixed',
              left: cx + p.offsetX,
              top: cy + p.offsetY,
              zIndex: 65,
              pointerEvents: 'none',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span
              style={{ animation: `float-in-out ${p.duration}ms ease-in-out ${p.delay}ms both` }}
              className={`block text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border shadow-sm backdrop-blur-sm whitespace-nowrap ${colorClass}`}
            >
              {p.content}
            </span>
          </div>
        )
      })}
    </>
  )
}
