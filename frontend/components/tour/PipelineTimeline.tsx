'use client'

import { useI18n } from '@/contexts/I18nContext'
import { Database, Cpu, Layers, GitBranch, Server, Monitor } from 'lucide-react'

const STEPS = [
  { key: 'rawData',  icon: Database, color: 'bg-blue-500',   desc: '397,884 rows\nUCI CSV' },
  { key: 'etl',      icon: Cpu,      color: 'bg-violet-500', desc: '17 tables\nDuckDB 1.5' },
  { key: 'features', icon: Layers,   color: 'bg-indigo-500', desc: 'RFM · MBA\nTime Series' },
  { key: 'training', icon: GitBranch,color: 'bg-cyan-500',   desc: '11 models\n6 paradigms' },
  { key: 'api',      icon: Server,   color: 'bg-teal-500',   desc: 'FastAPI\n30+ routes' },
  { key: 'frontend', icon: Monitor,  color: 'bg-green-500',  desc: 'Next.js 14\n9 pages' },
]

export function PipelineTimeline() {
  const { t } = useI18n()

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center min-w-[600px] px-4 py-6">
        {STEPS.map((step, idx) => {
          const Icon = step.icon
          const label = t(`tour.pipeline.steps.${step.key}`)
          const descLines = step.desc.split('\n')
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-2 flex-1">
                {/* Icon circle */}
                <div className={`w-12 h-12 rounded-full ${step.color} flex items-center justify-center shadow-md`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                {/* Label */}
                <p className="text-sm font-semibold text-center">{label}</p>
                {/* Desc */}
                <div className="text-center">
                  {descLines.map((line, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground leading-tight">{line}</p>
                  ))}
                </div>
              </div>
              {/* Arrow connector */}
              {idx < STEPS.length - 1 && (
                <div className="flex-shrink-0 flex items-center px-1">
                  <div className="w-8 h-0.5 bg-border relative">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-border" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
