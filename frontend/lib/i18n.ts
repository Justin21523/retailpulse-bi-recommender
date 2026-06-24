// i18n 工具函式 — 以 dot-path 存取巢狀翻譯物件
export type Locale = 'zh-TW' | 'en'

export const SUPPORTED_LOCALES: Locale[] = ['zh-TW', 'en']
export const LOCALE_LABELS: Record<Locale, string> = {
  'zh-TW': '中文',
  'en':    'EN',
}
export const DEFAULT_LOCALE: Locale = 'zh-TW'
export const STORAGE_KEY = 'retailpulse-locale'

export function getNestedValue(
  obj: Record<string, unknown>,
  path: string,
): string {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return path
    current = (current as Record<string, unknown>)[part]
  }
  if (typeof current === 'string') return current
  return path  // fallback: return key path
}
