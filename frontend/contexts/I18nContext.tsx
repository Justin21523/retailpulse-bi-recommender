'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { getNestedValue, type Locale, DEFAULT_LOCALE, STORAGE_KEY } from '@/lib/i18n'
import zhTW from '@/locales/zh-TW'
import en from '@/locales/en'

const LOCALES: Record<Locale, Record<string, unknown>> = {
  'zh-TW': zhTW as unknown as Record<string, unknown>,
  'en':    en as unknown as Record<string, unknown>,
}

type I18nCtx = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nCtx>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (k) => k,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null
    if (saved && saved in LOCALES) setLocaleState(saved)
    setMounted(true)
  }, [])

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }

  const t = (key: string): string =>
    getNestedValue(LOCALES[locale], key)

  // Suppress hydration mismatch: render children only after mount (localStorage read)
  if (!mounted) {
    return (
      <I18nContext.Provider value={{ locale: DEFAULT_LOCALE, setLocale, t: (k) => getNestedValue(LOCALES[DEFAULT_LOCALE], k) }}>
        {children}
      </I18nContext.Provider>
    )
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
