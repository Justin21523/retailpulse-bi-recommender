// 所有 API hooks 集中定義
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type {
  MetricsOverview,
  MonthlyRevenue,
  CountryMetric,
  ProductItem,
  CustomerListItem,
  CustomerListResponse,
  RFMScatterPoint,
  SegmentSummary,
  RFMResult,
  CohortMatrix,
  MBARule,
  BasketSummary,
  RecommendationItem,
  InsightItem,
} from '@/types/index'

export function useMetricsOverview() {
  return useQuery({
    queryKey: ['metrics', 'overview'],
    queryFn: () => apiFetch<MetricsOverview>('/metrics/overview'),
  })
}

export function useMonthlyRevenue() {
  return useQuery({
    queryKey: ['metrics', 'monthly'],
    queryFn: () => apiFetch<MonthlyRevenue[]>('/metrics/revenue/monthly'),
  })
}

export function useCountries(limit = 10) {
  return useQuery({
    queryKey: ['metrics', 'countries', limit],
    queryFn: () => apiFetch<CountryMetric[]>('/metrics/countries', { limit }),
  })
}

export function useTopProducts(n = 10) {
  return useQuery({
    queryKey: ['products', 'top', n],
    queryFn: () => apiFetch<ProductItem[]>('/products/top', { n }),
  })
}

export function useRFMScatter() {
  return useQuery({
    queryKey: ['rfm', 'scatter'],
    queryFn: () => apiFetch<RFMScatterPoint[]>('/rfm/scatter'),
    staleTime: 10 * 60 * 1000, // 全量 4338 筆，10 分鐘才重 fetch
  })
}

export function useRFMSegments() {
  return useQuery({
    queryKey: ['rfm', 'segments'],
    queryFn: () => apiFetch<SegmentSummary[]>('/rfm/segments'),
  })
}

export function useCustomerList(params: {
  segment?: string
  q?: string
  sort_by?: string
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: ['customers', 'list', params],
    queryFn: () => apiFetch<CustomerListResponse>('/customers', params),
    placeholderData: keepPreviousData,
  })
}

export function useCustomerRFM(customerId: string | null) {
  return useQuery({
    queryKey: ['customers', customerId, 'rfm'],
    queryFn: () => apiFetch<RFMResult>(`/customers/${customerId}/rfm`),
    enabled: !!customerId,
  })
}

export function useCohortMatrix() {
  return useQuery({
    queryKey: ['cohort', 'matrix'],
    queryFn: () => apiFetch<CohortMatrix>('/cohort/matrix'),
    staleTime: 10 * 60 * 1000,
  })
}

export function useBasketRules(params: {
  min_lift?: number
  min_confidence?: number
  limit?: number
}) {
  return useQuery({
    queryKey: ['basket', 'rules', params],
    queryFn: () => apiFetch<MBARule[]>('/basket/rules', params),
  })
}

export function useBasketSummary() {
  return useQuery({
    queryKey: ['basket', 'summary'],
    queryFn: () => apiFetch<BasketSummary>('/basket/summary'),
  })
}

export function useCustomerRecommendations(customerId: string | null, n = 10) {
  return useQuery({
    queryKey: ['recs', 'customer', customerId, n],
    queryFn: () =>
      apiFetch<RecommendationItem[]>(`/recommendations/customer/${customerId}`, { n }),
    enabled: !!customerId,
  })
}

export function useProductRecommendations(stockCode: string | null, n = 10) {
  return useQuery({
    queryKey: ['recs', 'product', stockCode, n],
    queryFn: () =>
      apiFetch<RecommendationItem[]>(`/recommendations/product/${stockCode}`, { n }),
    enabled: !!stockCode,
  })
}

export function useInsights() {
  return useQuery({
    queryKey: ['insights', 'summary'],
    queryFn: () => apiFetch<InsightItem[]>('/insights/summary'),
  })
}

// ── Phase 4 Hooks ─────────────────────────────────────────────────────────
import type {
  ForecastResponse,
  ChurnScore,
  CLVScore,
  AnomalyCustomer,
  ModelRegistryItem,
  ABExperiment,
  ABResult,
  NLPSearchResult,
  ProductCluster,
  ModelComparisonItem,
  FeatureImportanceItem,
  ForecastModelMetric,
} from '@/types/index'

export function useForecast(model: 'sarima' | 'ets' | 'lstm' = 'sarima', horizon = 30) {
  return useQuery({
    queryKey: ['forecast', model, horizon],
    queryFn: () => apiFetch<ForecastResponse>('/forecast/revenue', { model, horizon }),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
  })
}

export function useChurnRisk(threshold = 0.5, limit = 50) {
  return useQuery({
    queryKey: ['ml', 'churn-risk', threshold, limit],
    queryFn: () => apiFetch<ChurnScore[]>('/ml/customers/churn-risk', { threshold, limit }),
    staleTime: 5 * 60 * 1000,
  })
}

export function useAnomalies(topK = 20) {
  return useQuery({
    queryKey: ['ml', 'anomalies', topK],
    queryFn: () => apiFetch<AnomalyCustomer[]>('/ml/customers/anomalies', { top_k: topK }),
    staleTime: 5 * 60 * 1000,
  })
}

export function useModelRegistry() {
  return useQuery({
    queryKey: ['ml', 'registry'],
    queryFn: () => apiFetch<ModelRegistryItem[]>('/ml/models/registry'),
    staleTime: 10 * 60 * 1000,
  })
}

export function useExperiments() {
  return useQuery({
    queryKey: ['ab', 'experiments'],
    queryFn: () => apiFetch<ABExperiment[]>('/ab/experiments'),
    refetchOnMount: 'always',
  })
}

export function useExperimentResults(experimentId: string | null) {
  return useQuery({
    queryKey: ['ab', 'results', experimentId],
    queryFn: () => apiFetch<ABResult[]>(`/ab/experiments/${experimentId}/results`),
    enabled: !!experimentId,
    refetchOnMount: 'always',
    retry: 2,
  })
}

export function useNLPSearch(query: string, n = 10) {
  return useQuery({
    queryKey: ['nlp', 'search', query, n],
    queryFn: () => apiFetch<NLPSearchResult[]>('/nlp/search', { q: query, n }),
    enabled: query.length > 1,
    staleTime: 2 * 60 * 1000,
  })
}

export function useProductClusters() {
  return useQuery({
    queryKey: ['nlp', 'clusters'],
    queryFn: () => apiFetch<ProductCluster[]>('/nlp/clusters'),
    staleTime: 10 * 60 * 1000,
  })
}

export function useChurnModelComparison() {
  return useQuery({
    queryKey: ['tree', 'churn', 'compare'],
    queryFn: () => apiFetch<ModelComparisonItem[]>('/tree/churn/compare'),
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
}

export function useFeatureImportance() {
  return useQuery({
    queryKey: ['tree', 'feature-importance'],
    queryFn: () => apiFetch<FeatureImportanceItem[]>('/tree/feature-importance'),
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
}

export function useForecastDecomposition() {
  return useQuery({
    queryKey: ['forecast', 'decomposition'],
    queryFn: () => apiFetch<{
      dates: string[]
      observed: number[]
      trend: number[]
      seasonal: number[]
      residual: number[]
    }>('/forecast/decomposition'),
    staleTime: 30 * 60 * 1000,
    retry: false,
  })
}

export function useChurnROC() {
  return useQuery({
    queryKey: ['ml', 'churn', 'roc'],
    queryFn: () => apiFetch<Array<{
      threshold: number; fpr: number; tpr: number
      tp: number; fp: number; tn: number; fn: number
    }>>('/ml/models/churn/roc'),
    staleTime: 30 * 60 * 1000,
    retry: false,
  })
}

export function useAllChurnRisk() {
  return useQuery({
    queryKey: ['ml', 'churn', 'all'],
    queryFn: () => apiFetch<ChurnScore[]>('/ml/customers/all-churn'),
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
}

export function useCLVRanking(limit = 20) {
  return useQuery({
    queryKey: ['ml', 'clv', 'ranking', limit],
    queryFn: () => apiFetch<CLVScore[]>('/ml/customers/clv-ranking', { limit }),
    staleTime: 10 * 60 * 1000,
  })
}

export function useExperimentSummary(experimentId: string | null) {
  return useQuery({
    queryKey: ['ab', 'summary', experimentId],
    queryFn: () => apiFetch<Array<{
      variant: string; total_events: number; conversions: number; impressions: number
    }>>(`/ab/experiments/${experimentId}/summary`),
    enabled: !!experimentId,
    refetchOnMount: 'always',
  })
}

export function useForecastModels() {
  return useQuery({
    queryKey: ['forecast', 'models'],
    queryFn: () => apiFetch<ForecastModelMetric[]>('/forecast/models'),
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
}

export function useCustomerPurchaseHistory(customerId: string | null) {
  return useQuery<{ month: string; revenue: number }[]>({
    queryKey: ['ml', 'customer-history', customerId],
    queryFn: () => apiFetch<{ month: string; revenue: number }[]>(`/ml/customers/${customerId}/purchase-history`),
    enabled: !!customerId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useForecastAll(horizon = 7) {
  const sarima = useQuery({
    queryKey: ['forecast', 'sarima', horizon],
    queryFn: () => apiFetch<ForecastResponse>('/forecast/revenue', { model: 'sarima', horizon }),
    staleTime: 60 * 1000,
    refetchOnMount: 'always' as const,
  })
  const ets = useQuery({
    queryKey: ['forecast', 'ets', horizon],
    queryFn: () => apiFetch<ForecastResponse>('/forecast/revenue', { model: 'ets', horizon }),
    staleTime: 60 * 1000,
    refetchOnMount: 'always' as const,
  })
  const lstm = useQuery({
    queryKey: ['forecast', 'lstm', horizon],
    queryFn: () => apiFetch<ForecastResponse>('/forecast/revenue', { model: 'lstm', horizon }),
    staleTime: 60 * 1000,
    refetchOnMount: 'always' as const,
  })
  return { sarima, ets, lstm }
}
