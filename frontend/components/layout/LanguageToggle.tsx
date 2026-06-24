'use client'

import { useI18n } from '@/contexts/I18nContext'
import { LOCALE_LABELS, type Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function LanguageToggle() {
  const { locale, setLocale } = useI18n()
  const locales: Locale[] = ['zh-TW', 'en']

  return (
    <div className="flex items-center gap-1 rounded-md border border-sidebar-border bg-sidebar-accent/30 p-0.5">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={cn(
            'px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
            locale === l
              ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
              : 'text-sidebar-foreground/60 hover:text-sidebar-foreground/90',
          )}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  )
}
