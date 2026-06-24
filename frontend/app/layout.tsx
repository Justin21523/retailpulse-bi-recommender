import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { MobileShell } from '@/components/layout/MobileShell'
import { I18nProvider } from '@/contexts/I18nContext'
import { AppGuide } from '@/components/tour/AppGuide'
import { DataJourneyPanel } from '@/components/journey/DataJourneyPanel'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'RetailPulse BI · 零售智慧分析平台',
  description: 'Retail analytics & ML recommendation platform — UCI Online Retail dataset',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" className={inter.variable}>
      <body className="antialiased bg-background text-foreground">
        <I18nProvider>
          <Providers>
            <MobileShell>{children}</MobileShell>
            <AppGuide />
            <DataJourneyPanel />
          </Providers>
        </I18nProvider>
      </body>
    </html>
  )
}
