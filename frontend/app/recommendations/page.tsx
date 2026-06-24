'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { SegmentBadge } from '@/components/cards/SegmentBadge'
import { DynamicInsight } from '@/components/analysis/DynamicInsight'
import {
  useCustomerRFM,
  useCustomerRecommendations,
  useProductRecommendations,
  useNLPSearch,
} from '@/hooks/useApi'
import { useI18n } from '@/contexts/I18nContext'
import { apiFetch } from '@/lib/api'
import { formatGBP, REASON_BADGE_STYLES } from '@/lib/utils'
import { Search, Star } from 'lucide-react'
import type { RecommendationItem, BanditRecommendationResponse } from '@/types/index'

function RecommCard({ item }: { item: RecommendationItem }) {
  const reasonKey = item.reason.includes('basket') || item.reason.includes('FBT') ? 'FBT'
    : item.reason.includes('segment') || item.reason.includes('Segment') ? 'Segment'
    : 'Popular'
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">{item.stock_code}</p>
            <p className="text-sm font-medium mt-0.5 leading-tight">{item.description}</p>
          </div>
          <Badge variant="outline" className={`text-xs shrink-0 ${REASON_BADGE_STYLES[reasonKey]}`}>
            {reasonKey}
          </Badge>
        </div>
        {(item.lift || item.score) && (
          <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
            {item.lift && <span>Lift: <strong>{item.lift.toFixed(2)}</strong></span>}
            {item.confidence && <span>Conf: <strong>{(item.confidence * 100).toFixed(0)}%</strong></span>}
            {item.score && <span>Score: <strong>{item.score.toFixed(3)}</strong></span>}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1 italic">{item.reason}</p>
      </CardContent>
    </Card>
  )
}

// Bandit 手臂統計橫條圖
function BanditChart({ customerId }: { customerId: string }) {
  const { t } = useI18n()
  const [banditData, setBanditData] = useState<BanditRecommendationResponse | null>(null)

  useEffect(() => {
    if (!customerId) return
    apiFetch<BanditRecommendationResponse>(`/recommendations/bandit/${customerId}`, { n: 1 })
      .then(setBanditData)
      .catch(() => {})
  }, [customerId])

  if (!banditData?.arm_stats) return null

  const chartData = Object.entries(banditData.arm_stats).map(([arm, stats]) => ({
    arm,
    ctr: Number((stats.estimated_ctr * 100).toFixed(2)),
    isBest: arm === banditData.best_arm,
  }))

  const bestArm = banditData.best_arm

  return (
    <Card data-tour="rec-bandit">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('recommendations.bandit.title')}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {t('recommendations.bandit.currentArm')}：<strong className="text-primary">{bestArm}</strong>
        </p>
      </CardHeader>
      <CardContent>
        <DynamicInsight
          insight={t('recommendations.insight')
            .replace('{{bestArm}}', bestArm)
            .replace('{{ctr}}', chartData.find(d => d.isBest)?.ctr.toFixed(2) ?? '—')}
          variant="success"
          className="mb-4"
        />
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="arm"
              width={110}
              tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              tickLine={false}
            />
            <Tooltip
              formatter={(v) => [`${v}%`, t('recommendations.bandit.ctr')]}
              contentStyle={{ fontSize: '12px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
            />
            <Bar dataKey="ctr" name="ctr" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.isBest ? 'var(--color-primary)' : 'var(--color-muted-foreground)'}
                  fillOpacity={entry.isBest ? 0.9 : 0.5}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function CustomerTab() {
  const { t } = useI18n()
  const params = useSearchParams()
  const [inputId, setInputId] = useState(params.get('customer') ?? '')
  const [activeId, setActiveId] = useState(params.get('customer') ?? '')
  const [n, setN] = useState(10)

  const { data: profile, isLoading: loadingProfile } = useCustomerRFM(activeId || null)
  const { data: recs, isLoading: loadingRecs } = useCustomerRecommendations(activeId || null, n)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder={t('recommendations.customer.placeholder')}
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setActiveId(inputId.trim())}
          className="h-9 text-sm"
        />
        <Button size="sm" onClick={() => setActiveId(inputId.trim())} className="h-9">
          <Search className="h-4 w-4 mr-1" /> {t('recommendations.customer.searchBtn')}
        </Button>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">
          {t('recommendations.customer.count')}: {n}
        </label>
        <Slider
          min={3}
          max={20}
          step={1}
          value={[n]}
          onValueChange={(v) => v[0] !== undefined && setN(v[0])}
          className="mt-1 w-48"
        />
      </div>

      {activeId && (
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            {loadingProfile ? (
              <Skeleton className="h-16 w-full" />
            ) : profile ? (
              <div className="flex items-center gap-4 flex-wrap">
                <SegmentBadge segment={profile.segment} />
                <span className="text-sm">
                  <span className="text-muted-foreground">RFM:</span> {profile.rfm_score}
                </span>
                <span className="text-sm">
                  <span className="text-muted-foreground">{t('customers.profile.monetary')}:</span>{' '}
                  <strong>{formatGBP(profile.monetary)}</strong>
                </span>
                <span className="text-sm">
                  <span className="text-muted-foreground">{t('customers.profile.clv')}:</span>{' '}
                  <strong className="text-primary">{formatGBP(profile.estimated_clv)}</strong>
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('recommendations.notFound')}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bandit 策略圖（在客戶選定後顯示） */}
      {activeId && profile && <BanditChart customerId={activeId} />}

      {activeId && (
        <div>
          <h3 className="text-sm font-medium mb-3">
            {loadingRecs ? t('recommendations.customer.loading') : t('recommendations.customer.count_result').replace('{{n}}', String(recs?.length ?? 0))}
          </h3>
          {loadingRecs ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recs?.map((item) => <RecommCard key={item.stock_code} item={item} />)}
            </div>
          )}
        </div>
      )}

      {!activeId && (
        <p className="text-sm text-muted-foreground">{t('recommendations.noCustomer')}</p>
      )}
    </div>
  )
}

function ProductTab() {
  const { t } = useI18n()
  const [inputCode, setInputCode] = useState('')
  const [activeCode, setActiveCode] = useState('')
  const [n, setN] = useState(10)

  const { data: recs, isLoading: loadingRecs } = useProductRecommendations(activeCode || null, n)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder={t('recommendations.product.placeholder')}
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setActiveCode(inputCode.trim())}
          className="h-9 text-sm"
        />
        <Button size="sm" onClick={() => setActiveCode(inputCode.trim())} className="h-9">
          <Search className="h-4 w-4 mr-1" /> {t('recommendations.product.findSimilar')}
        </Button>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">
          {t('recommendations.customer.count')}: {n}
        </label>
        <Slider
          min={3}
          max={20}
          step={1}
          value={[n]}
          onValueChange={(v) => v[0] !== undefined && setN(v[0])}
          className="mt-1 w-48"
        />
      </div>

      {activeCode && (
        <div>
          <h3 className="text-sm font-medium mb-3">
            {loadingRecs
              ? t('recommendations.product.loading')
              : t('recommendations.product.count_result')
                  .replace('{{n}}', String(recs?.length ?? 0))
                  .replace('{{code}}', activeCode)}
          </h3>
          {loadingRecs ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : recs?.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recs.map((item) => <RecommCard key={item.stock_code} item={item} />)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('recommendations.product.notFound')}</p>
          )}
        </div>
      )}

      {!activeCode && (
        <p className="text-sm text-muted-foreground">{t('recommendations.product.hint')}</p>
      )}
    </div>
  )
}

function SemanticTab() {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const { data: results, isLoading } = useNLPSearch(activeQuery, 10)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder={t('recommendations.semantic.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setActiveQuery(query.trim())}
          className="h-9 text-sm"
        />
        <Button size="sm" onClick={() => setActiveQuery(query.trim())} className="h-9">
          <Search className="h-4 w-4 mr-1" /> {t('common.search')}
        </Button>
      </div>
      {activeQuery && (
        <div>
          <h3 className="text-sm font-medium mb-3">
            {isLoading ? t('common.loading') : `${t('recommendations.semantic.results')}: ${results?.length ?? 0}`}
          </h3>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : results?.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {results.map((item) => (
                <Card key={item.stock_code} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <p className="font-mono text-xs text-muted-foreground">{item.stock_code}</p>
                    <p className="text-sm font-medium mt-0.5">{item.description}</p>
                    <p className="text-xs text-primary mt-1 font-mono">
                      {t('recommendations.semantic.similarity')}: {item.similarity_score?.toFixed(4)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default function RecommendationsPage() {
  const { t } = useI18n()

  return (
    <div className="space-y-6 max-w-screen-xl">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('recommendations.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('recommendations.subtitle')}</p>
      </div>

      <Tabs data-tour="rec-tabs" defaultValue="customer">
        <TabsList className="mb-4">
          <TabsTrigger value="customer">{t('recommendations.tabs.customer')}</TabsTrigger>
          <TabsTrigger value="product">{t('recommendations.tabs.product')}</TabsTrigger>
          <TabsTrigger value="semantic">{t('recommendations.tabs.semantic')}</TabsTrigger>
        </TabsList>

        <TabsContent value="customer">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('recommendations.tabs.customer')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-32 w-full" />}>
                <CustomerTab />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="product">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('recommendations.tabs.product')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="semantic">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('recommendations.tabs.semantic')}</CardTitle>
            </CardHeader>
            <CardContent>
              <SemanticTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 評估指標摘要 */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold">{t('recommendations.eval.title')}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">P@10</p>
              <p className="font-mono font-bold text-lg">0.0407</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">R@10</p>
              <p className="font-mono font-bold text-lg">0.0165</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Coverage</p>
              <p className="font-mono font-bold text-lg">2.0%</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t('recommendations.eval.split')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
