'use client'

import Link from 'next/link'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { useI18n } from '@/contexts/I18nContext'
import { cn } from '@/lib/utils'

export interface TourStepCardProps {
  step:        number
  title:       string       // page name in current locale
  href:        string
  icon:        LucideIcon
  description: string
  techStack:   string[]
  highlights:  string[]     // 3 bullet points
  accentColor: string       // tailwind class e.g. 'text-blue-600'
  bgColor:     string       // e.g. 'bg-blue-50'
}

export function TourStepCard({
  step, title, href, icon: Icon, description,
  techStack, highlights, accentColor, bgColor,
}: TourStepCardProps) {
  const { t } = useI18n()

  return (
    <div className={cn('rounded-xl border border-border p-5 space-y-4 hover:shadow-md transition-shadow', bgColor)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Step number badge */}
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white', accentColor.replace('text-', 'bg-'))}>
            {step}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Icon className={cn('w-4 h-4', accentColor)} />
              <h3 className="font-semibold text-base">{title}</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <Link
          href={href}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
            'bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary',
          )}
        >
          {t('common.goToPage')}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Tech stack chips */}
      <div className="flex flex-wrap gap-1.5">
        {techStack.map((tech) => (
          <span key={tech} className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium border', accentColor, 'bg-background/60 border-current/20')}>
            {tech}
          </span>
        ))}
      </div>

      {/* Highlights */}
      <ul className="space-y-1">
        {highlights.map((h, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={cn('mt-0.5 text-lg leading-none', accentColor)}>›</span>
            <span>{h}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
