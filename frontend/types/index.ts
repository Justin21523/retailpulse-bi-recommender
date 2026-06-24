// RetailPulse API TypeScript 型別定義

// ── 既有 endpoints ────────────────────────────────────────────────────────
export interface MetricsOverview {
  total_revenue: number;
  total_orders: number;
  aov: number;
  active_customers: number;
  top_country: string;
}

export interface ProductItem {
  stock_code: string;
  description: string;
  total_revenue: number;
  order_count: number;
  avg_price: number;
  popularity_rank?: number;
}

export interface RecommendationItem {
  stock_code: string;
  description: string;
  score: number | null;
  lift: number | null;
  confidence: number | null;
  support: number | null;
  reason: string;
}

// ── Phase 2：指標 ─────────────────────────────────────────────────────────
export interface MonthlyRevenue {
  month: string;
  revenue: number;
  orders: number;
  unique_customers: number;
}

export interface CountryMetric {
  country: string;
  revenue: number;
  orders: number;
  customers: number;
  aov: number;
  revenue_pct: number;
}

// ── Phase 2：客戶 ─────────────────────────────────────────────────────────
export interface CustomerListItem {
  customer_id: string;
  segment: 'Champions' | 'Loyal Customers' | 'At Risk' | 'Lost';
  rfm_score: string;
  recency_days: number;
  frequency: number;
  monetary: number;
  r_score: number;
  f_score: number;
  m_score: number;
}

export interface CustomerListResponse {
  items: CustomerListItem[];
  total: number;
}

export interface RFMScatterPoint {
  customer_id: string;
  recency_days: number;
  frequency: number;
  monetary: number;
  segment: string;
  rfm_score: string;
}

export interface SegmentSummary {
  segment: string;
  count: number;
  avg_recency: number;
  avg_frequency: number;
  avg_monetary: number;
  total_revenue: number;
  revenue_pct: number;
}

export interface RFMResult {
  customer_id: string;
  rfm_score: string;
  segment: string;
  recency_days: number;
  frequency: number;
  monetary: number;
  r_score: number;
  f_score: number;
  m_score: number;
  avg_order_value: number;
  estimated_clv: number;
  rank_in_segment: number;
}

// ── Phase 2：Cohort ───────────────────────────────────────────────────────
export interface CohortMatrix {
  cohort_months: string[];
  cohort_sizes: number[];
  periods: string[];
  matrix: (number | null)[][];
}

// ── Phase 2：Market Basket ────────────────────────────────────────────────
export interface MBARule {
  antecedents: string;
  consequents: string;
  support: number;
  confidence: number;
  lift: number;
  antecedent_description?: string | null;
  consequent_description?: string | null;
}

export interface BasketSummary {
  total_rules: number;
  avg_lift: number;
  max_lift: number;
  avg_confidence: number;
  avg_support: number;
}

// ── Phase 2：Insights ─────────────────────────────────────────────────────
export interface InsightItem {
  type: string;
  title: string;
  description: string;
  value: string;
  icon: string;
}

// ── Phase 4：Forecast ─────────────────────────────────────────────────────
export interface ForecastPoint {
  date: string;
  predicted_revenue: number;
  lower_ci: number;
  upper_ci: number;
  model_name: string;
}

export interface ForecastResponse {
  forecasts: ForecastPoint[];
  model_name: string;
  horizon_days: number;
  mape: number | null;
}

// ── Phase 4：ML Insights ──────────────────────────────────────────────────
export interface ChurnScore {
  customer_id: string;
  churn_probability: number;
  risk_level: string;
  segment?: string | null;
  recency_days?: number | null;
}

export interface CLVScore {
  customer_id: string;
  predicted_clv: number;
  current_monetary: number;
  segment?: string | null;
}

export interface AnomalyCustomer {
  customer_id: string;
  anomaly_score: number;
  is_anomaly: boolean;
  segment?: string | null;
}

export interface ModelRegistryItem {
  model_id: string;
  model_name: string;
  model_type: string;
  metrics: Record<string, unknown>;
  trained_at?: string | null;
  description?: string | null;
}

// ── Phase 4：A/B Testing ──────────────────────────────────────────────────
export interface ABExperiment {
  experiment_id: string;
  name: string;
  description?: string;
  variants: string[];
  status: string;
  started_at?: string;
}

export interface ABResult {
  experiment_id: string;
  metric: string;
  control_variant: string;
  treatment_variant: string;
  control_rate: number;
  treatment_rate: number;
  p_value: number;
  effect_size: number;
  significant: boolean;
}

export interface SampleSizeResponse {
  n_per_variant: number;
  baseline_rate: number;
  mde: number;
  power: number;
  alpha: number;
  expected_treatment_rate: number;
}

// ── Phase 4：NLP ──────────────────────────────────────────────────────────
export interface NLPSearchResult {
  stock_code: string;
  description?: string | null;
  similarity_score: number;
}

export interface ProductCluster {
  cluster_id: number;
  cluster_label: string;
  product_count: number;
  top_keywords?: string | null;
}

export interface BanditArmStats {
  estimated_ctr: number;
  alpha: number;
  beta: number;
  pulls: number;
  rewards: number;
  std?: number;
}

export interface BanditRecommendationResponse {
  customer_id: string;
  best_arm: string;
  recommendations: RecommendationItem[];
  arm_stats: Record<string, BanditArmStats>;
}

export interface ModelComparisonItem {
  model_name: string;
  model_type: string;
  auc_roc: number | null;
  f1: number | null;
  precision: number | null;
  recall: number | null;
}

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
  rank: number;
}

export interface CustomerCLVItem {
  customer_id: string;
  segment: string;
  predicted_clv: number;
  current_monetary: number;
}

export interface ForecastModelMetric {
  model: string;
  mape: number | null;
  aic: number | null;
  bic: number | null;
  trained_at: string | null;
}
