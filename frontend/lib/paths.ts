const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const APP_BASE_PATH = configuredBasePath.replace(/\/$/, '')

export function publicPath(path: string): string {
  if (!APP_BASE_PATH || path.startsWith('#')) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (normalized === APP_BASE_PATH || normalized.startsWith(`${APP_BASE_PATH}/`)) {
    return normalized
  }
  return `${APP_BASE_PATH}${normalized}`
}

export function appPathname(pathname: string | null): string {
  if (!pathname || !APP_BASE_PATH) return pathname || '/'
  if (pathname === APP_BASE_PATH) return '/'
  if (pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname.slice(APP_BASE_PATH.length) || '/'
  }
  return pathname
}

export function navigateToPublicPath(path: string): boolean {
  if (!APP_BASE_PATH || typeof window === 'undefined') return false
  window.location.assign(publicPath(path))
  return true
}
