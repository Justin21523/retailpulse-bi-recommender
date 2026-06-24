'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Users,
  CalendarRange,
  ShoppingCart,
  Star,
  Circle,
  TrendingUp,
  Brain,
  FlaskConical,
  Map,
  Info,
  X,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/contexts/I18nContext'
import { LanguageToggle } from './LanguageToggle'
import { AboutModal } from './AboutModal'

function ApiStatusDot() {
  const [healthy, setHealthy] = useState<boolean | null>(null)
  const { t } = useI18n()

  useEffect(() => {
    fetch('/api/health')
      .then((r) => setHealthy(r.ok))
      .catch(() => setHealthy(false))
  }, [])

  return (
    <div className="flex items-center gap-2 text-[11px] text-sidebar-foreground/60">
      <Circle
        className={cn(
          'h-2 w-2 fill-current',
          healthy === true  ? 'text-success'      :
          healthy === false ? 'text-destructive'  :
                              'text-muted-foreground'
        )}
      />
      <span>
        {healthy === true  ? t('common.apiConnected') :
         healthy === false ? t('common.apiOffline')   :
                             t('common.apiChecking')  }
      </span>
    </div>
  )
}

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { t } = useI18n()
  const [aboutOpen, setAboutOpen] = useState(false)

  const NAV_ITEMS = [
    { href: '/upload',          label: t('nav.upload'),            icon: Upload },
    { href: '/',                label: t('nav.dashboard'),        icon: LayoutDashboard },
    { href: '/customers',       label: t('nav.customers'),         icon: Users },
    { href: '/cohort',          label: t('nav.cohort'),            icon: CalendarRange },
    { href: '/basket',          label: t('nav.basket'),            icon: ShoppingCart },
    { href: '/recommendations', label: t('nav.recommendations'),   icon: Star },
    { href: '/forecast',        label: t('nav.forecast'),          icon: TrendingUp },
    { href: '/ml-insights',     label: t('nav.mlInsights'),        icon: Brain },
    { href: '/ab-testing',      label: t('nav.abTesting'),         icon: FlaskConical },
    { href: '/tour',            label: t('nav.tour'),              icon: Map },
  ]

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-40"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        'w-56 shrink-0 flex flex-col h-screen bg-sidebar border-r border-sidebar-border',
        'fixed inset-y-0 left-0 z-50 transition-transform duration-300',
        'md:relative md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        {/* 品牌 Logo 區 */}
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 rounded-full bg-sidebar-primary" />
            <div>
              <p className="text-sm font-bold text-sidebar-primary-foreground tracking-tight">
                RetailPulse BI
              </p>
              <p className="text-[10px] text-sidebar-foreground/50 mt-0.5">
                {t('nav.platform')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
            aria-label="關閉選單"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      {/* 導覽連結 */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-primary/20 text-sidebar-primary border-l-2 border-sidebar-primary pl-[10px]'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border-l-2 border-transparent pl-[10px]',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* 底部：About + 語言切換 + 版本 + API 狀態 */}
      <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
        <button
          onClick={() => setAboutOpen(true)}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          About this project
        </button>
        <LanguageToggle />
        <ApiStatusDot />
        <p className="text-[10px] text-sidebar-foreground/40">
          {t('common.version')}
        </p>
      </div>
    </aside>

    <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  )
}
