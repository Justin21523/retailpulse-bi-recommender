'use client'

import { useState } from 'react'
import { Copy, Check, Terminal, Clock } from 'lucide-react'
import { useI18n } from '@/contexts/I18nContext'
import { cn } from '@/lib/utils'

interface ReproduceStep {
  label: string
  cmd:   string
  time:  string
}

function CopyableCommand({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false)
  const { t } = useI18n()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-zinc-900 dark:bg-zinc-800 px-3 py-2 font-mono text-sm text-green-400 group">
      <Terminal className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      <span className="flex-1 text-xs">{cmd}</span>
      <button
        onClick={handleCopy}
        className={cn(
          'p-1 rounded transition-colors',
          copied
            ? 'text-green-400'
            : 'text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100',
        )}
        title={t('common.copy')}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

export function QuickReproducePanel() {
  const { t } = useI18n()

  const steps: ReproduceStep[] = [
    { label: t('tour.reproduce.step1.label'), cmd: t('tour.reproduce.step1.cmd'), time: t('tour.reproduce.step1.time') },
    { label: t('tour.reproduce.step2.label'), cmd: t('tour.reproduce.step2.cmd'), time: t('tour.reproduce.step2.time') },
    { label: t('tour.reproduce.step3.label'), cmd: t('tour.reproduce.step3.cmd'), time: t('tour.reproduce.step3.time') },
    { label: t('tour.reproduce.step4.label'), cmd: t('tour.reproduce.step4.cmd'), time: t('tour.reproduce.step4.time') },
    { label: t('tour.reproduce.step5.label'), cmd: t('tour.reproduce.step5.cmd'), time: t('tour.reproduce.step5.time') },
  ]

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-start gap-4">
            {/* Step number */}
            <div className="flex-shrink-0 flex flex-col items-center gap-1">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                {idx + 1}
              </div>
              {idx < steps.length - 1 && <div className="w-0.5 h-4 bg-border" />}
            </div>

            <div className="flex-1 space-y-1.5 pb-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{step.label}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {step.time}
                </div>
              </div>
              <CopyableCommand cmd={step.cmd} />
            </div>
          </div>
        ))}
      </div>

      {/* Status check */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">{t('tour.reproduce.checkStatus')}:</p>
        <CopyableCommand cmd={t('tour.reproduce.statusCmd')} />
      </div>
    </div>
  )
}
