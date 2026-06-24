'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SegmentBadge } from '@/components/cards/SegmentBadge'
import { RFMScatterChart } from '@/components/charts/RFMScatterChart'
import { SegmentPieChart } from '@/components/charts/SegmentPieChart'
import { DynamicInsight } from '@/components/analysis/DynamicInsight'
import { useRFMScatter, useRFMSegments, useCustomerList, useCustomerRFM } from '@/hooks/useApi'
import { useI18n } from '@/contexts/I18nContext'
import { formatGBP, formatNumber } from '@/lib/utils'

const SEGMENT_KEYS = ['All', 'Champions', 'Loyal Customers', 'At Risk', 'Lost'] as const

const PAGE_SIZE = 25

export default function CustomersPage() {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState('All')
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: scatter, isLoading: loadingScatter } = useRFMScatter()
  const { data: segments, isLoading: loadingSegments } = useRFMSegments()
  const { data: customerData, isLoading: loadingList } = useCustomerList({
    segment: segment === 'All' ? undefined : segment,
    q: search.trim() || undefined,
    sort_by: 'monetary',
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })
  const { data: profile } = useCustomerRFM(selectedId)

  const filteredScatter = useMemo(() => {
    if (!scatter) return []
    if (segment === 'All') return scatter
    return scatter.filter((d) => d.segment === segment)
  }, [scatter, segment])

  const total = customerData?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // 動態解說：計算 At Risk 數量與收入佔比
  const insightText = useMemo(() => {
    if (!segments) return null
    const atRiskSeg = segments.find((s) => s.segment === 'At Risk')
    if (!atRiskSeg) return null
    return t('customers.insight')
      .replace('{{atRisk}}', String(atRiskSeg.count))
      .replace('{{revPct}}', atRiskSeg.revenue_pct.toFixed(1))
  }, [segments, t])

  return (
    <div className="space-y-6 max-w-screen-xl">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('customers.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('customers.subtitle')}</p>
      </div>

      {/* 動態解說 */}
      {insightText && (
        <div data-tour="customer-insight">
          <DynamicInsight insight={insightText} variant="warning" />
        </div>
      )}

      {/* 分群摘要 */}
      <div data-tour="segment-dist" className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('customers.segmentDist.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSegments ? (
              <Skeleton className="h-52 w-full" />
            ) : segments?.length ? (
              <SegmentPieChart data={segments} />
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('customers.segmentSummary.title')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingSegments ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-xs text-muted-foreground">
                    <th className="text-left py-2.5 px-4">{t('customers.table.segment')}</th>
                    <th className="text-right py-2.5 px-4">{t('customers.segmentSummary.count')}</th>
                    <th className="text-right py-2.5 px-4">{t('customers.segmentSummary.avgRecency')}</th>
                    <th className="text-right py-2.5 px-4">{t('customers.segmentSummary.avgSpend')}</th>
                    <th className="text-right py-2.5 px-4">{t('customers.segmentSummary.revShare')}</th>
                  </tr>
                </thead>
                <tbody>
                  {segments?.map((s) => (
                    <tr key={s.segment} className="border-b last:border-0 hover:bg-primary/5 transition-colors">
                      <td className="py-2.5 px-4">
                        <SegmentBadge segment={s.segment} />
                      </td>
                      <td className="py-2.5 px-4 text-right">{formatNumber(s.count)}</td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground">
                        {s.avg_recency.toFixed(0)}d
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium">
                        {formatGBP(s.avg_monetary)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground">
                        {s.revenue_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RFM Scatter Plot */}
      <Card data-tour="rfm-scatter">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t('customers.scatter.title')}
            {segment !== 'All' && ` — ${t(`customers.segments.${segment}` as any)}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingScatter ? (
            <Skeleton className="h-72 w-full" />
          ) : filteredScatter.length ? (
            <RFMScatterChart data={filteredScatter} />
          ) : null}
        </CardContent>
      </Card>

      {/* 客戶清單 */}
      <div data-tour="customer-list" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('customers.list.title')}</CardTitle>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder={t('customers.list.searchHint')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                className="h-8 text-sm w-48"
              />
              <Select
                value={segment}
                onValueChange={(v) => { if (v !== null) { setSegment(v); setPage(0) } }}
              >
                <SelectTrigger className="h-8 text-sm w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENT_KEYS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`customers.segments.${s}` as any)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingList ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 px-4">{t('customers.table.customerId')}</th>
                      <th className="text-left py-2 px-2">{t('customers.table.segment')}</th>
                      <th className="text-center py-2 px-2">{t('customers.table.rfmScore')}</th>
                      <th className="text-right py-2 px-4">{t('customers.table.recency')}</th>
                      <th className="text-right py-2 px-4">{t('customers.table.monetary')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerData?.items.map((c) => (
                      <tr
                        key={c.customer_id}
                        onClick={() => setSelectedId(c.customer_id)}
                        className={`border-b last:border-0 cursor-pointer hover:bg-muted/40 ${
                          selectedId === c.customer_id ? 'bg-muted/60' : ''
                        }`}
                      >
                        <td className="py-2 px-4 font-mono text-xs">{c.customer_id}</td>
                        <td className="py-2 px-2">
                          <SegmentBadge segment={c.segment} />
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-xs text-muted-foreground">
                          {c.rfm_score}
                        </td>
                        <td className="py-2 px-4 text-right text-muted-foreground text-xs">
                          {c.recency_days}d
                        </td>
                        <td className="py-2 px-4 text-right font-medium">
                          {formatGBP(c.monetary)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
                  <span>
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {formatNumber(total)}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      {t('customers.list.prev')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      {t('customers.list.next')}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 客戶 Profile 面板 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {profile ? `${t('customers.profile.title')} #${profile.customer_id}` : t('customers.profile.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!profile ? (
              <p className="text-sm text-muted-foreground">{t('customers.profile.noSelect')}</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <SegmentBadge segment={profile.segment} />
                  <span className="font-mono text-xs text-muted-foreground">
                    RFM: {profile.rfm_score}
                  </span>
                </div>

                {/* RFM 各分數進度條 */}
                <div className="space-y-2">
                  {[
                    { label: t('customers.profile.rScore'), score: profile.r_score },
                    { label: t('customers.profile.fScore'), score: profile.f_score },
                    { label: t('customers.profile.mScore'), score: profile.m_score },
                  ].map(({ label, score }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{score}/4</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(score / 4) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('customers.profile.recency')}</span>
                    <span>{profile.recency_days} {t('customers.profile.daysAgo')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('customers.profile.frequency')}</span>
                    <span>{profile.frequency} {t('customers.profile.orders')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('customers.profile.monetary')}</span>
                    <span className="font-medium">{formatGBP(profile.monetary)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t">
                    <span className="text-muted-foreground">{t('customers.profile.clv')}</span>
                    <span className="font-bold text-primary">{formatGBP(profile.estimated_clv)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('customers.profile.rankInSegment')}</span>
                    <span>#{profile.rank_in_segment}</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() =>
                    window.location.assign(`/recommendations?customer=${profile.customer_id}`)
                  }
                >
                  {t('customers.profile.viewRecs')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
