'use client'

import {
  LayoutDashboard, Users, CalendarRange, ShoppingCart,
  Star, TrendingUp, Brain, FlaskConical, Map,
  Database, Cpu, Activity, GitBranch,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/contexts/I18nContext'
import { PipelineTimeline } from '@/components/tour/PipelineTimeline'
import { MLParadigmCard, type MLParadigmCardProps } from '@/components/tour/MLParadigmCard'
import { TourStepCard, type TourStepCardProps } from '@/components/tour/TourStepCard'
import { QuickReproducePanel } from '@/components/tour/QuickReproducePanel'
import { useModelRegistry, useMetricsOverview } from '@/hooks/useApi'
import { publicPath } from '@/lib/paths'

// ── ML Paradigms definition ──────────────────────────────────────────────────
function getParadigms(t: (k: string) => string): MLParadigmCardProps[] {
  return [
    {
      paradigm:    t('tour.paradigms.supervised.name'),
      color:       'blue',
      model:       'CLV Regressor + Churn Classifier',
      algorithm:   '3-layer MLP · BCEWithLogitsLoss / MSELoss',
      metric:      'R²=0.875  AUC=1.0',
      description: 'RFM 6-dim features → predict revenue CLV and 180-day churn probability per customer.',
      tech:        ['PyTorch 2.x', 'StandardScaler', 'DuckDB'],
    },
    {
      paradigm:    t('tour.paradigms.unsupervised.name'),
      color:       'purple',
      model:       'Customer Autoencoder',
      algorithm:   'Encoder 6→32→16→8  Decoder 8→16→32→6',
      metric:      'anomaly_rate=0.5%',
      description: 'Unsupervised anomaly detection via reconstruction error threshold (mean + 2×std).',
      tech:        ['PyTorch', 'MSELoss', 'MinMaxScaler'],
    },
    {
      paradigm:    t('tour.paradigms.sequential.name'),
      color:       'green',
      model:       'LSTM Forecaster',
      algorithm:   'LSTM(1→32, 2 layers) + Linear(32→1)',
      metric:      'MAPE=36.95%',
      description: 'Sliding window (30 days) deep sequence model for daily revenue forecasting.',
      tech:        ['PyTorch LSTM', 'MinMaxScaler', 'Log-transform'],
    },
    {
      paradigm:    t('tour.paradigms.selfSupervised.name'),
      color:       'orange',
      model:       'Item2Vec',
      algorithm:   'Word2Vec Skip-Gram  vector_size=64  window=5',
      metric:      'vocab=3,665 products',
      description: 'Learn product co-purchase embeddings from customer purchase sequences — no labels needed.',
      tech:        ['gensim 4.4', '22,870 sequences', 'DuckDB FLOAT[64]'],
    },
    {
      paradigm:    t('tour.paradigms.transfer.name'),
      color:       'red',
      model:       'SBERT Product Encoder',
      algorithm:   'all-MiniLM-L6-v2  dim=384  L2-normalized',
      metric:      'cosine sim > 0.79',
      description: 'Zero-shot transfer: encode product descriptions into semantic space for search & similarity.',
      tech:        ['sentence-transformers', 'HuggingFace', 'Cosine Search'],
    },
    {
      paradigm:    t('tour.paradigms.rl.name'),
      color:       'yellow',
      model:       'Thompson Sampling Bandit',
      algorithm:   'Beta(α,β) per arm  5 arms  argmax(θ~Beta)',
      metric:      '5 recommendation strategies',
      description: 'Online RL: select best recommendation strategy per request, update with user feedback.',
      tech:        ['Beta Distribution', 'JSON state', '5 arms'],
    },
  ]
}

// ── Tour Steps definition ────────────────────────────────────────────────────
function getTourSteps(t: (k: string) => string) {
  return [
    {
      step: 1, href: '/', icon: LayoutDashboard,
      title: t('nav.dashboard'),
      accentColor: 'text-blue-600', bgColor: 'bg-blue-50/50 dark:bg-blue-950/20',
      description: 'KPI 總覽、月營收趨勢、國家分布、Top 商品 / Business KPIs, revenue trends, country distribution',
      techStack: ['DuckDB ETL', 'RFM Calc', 'FastAPI', 'Recharts'],
      highlights: [
        '£891萬 總營收 · 25,900 筆發票 · 4,338 位客戶',
        '月營收折線圖 + 國家收入長條圖',
        '即時 ML 模型狀態卡（共 11 個已訓練模型）',
      ],
    },
    {
      step: 2, href: '/customers', icon: Users,
      title: t('nav.customers'),
      accentColor: 'text-violet-600', bgColor: 'bg-violet-50/50 dark:bg-violet-950/20',
      description: 'RFM 分群、互動散點圖、客戶個人資料 / RFM segmentation, interactive scatter, customer profiles',
      techStack: ['K-Means RFM', 'Quintile Scoring', 'DuckDB Query'],
      highlights: [
        'R/F/M 三維五分位打分 → Champions / Loyal / At Risk / Lost',
        '互動式 3D 散點圖：選點查看客戶詳情',
        '個人 Profile：RFM + 預估 CLV + 推薦商品連結',
      ],
    },
    {
      step: 3, href: '/cohort', icon: CalendarRange,
      title: t('nav.cohort'),
      accentColor: 'text-teal-600', bgColor: 'bg-teal-50/50 dark:bg-teal-950/20',
      description: '月度同期群組留存矩陣 / Monthly cohort retention matrix visualization',
      techStack: ['Cohort Analysis', 'DuckDB Window', 'Heatmap'],
      highlights: [
        '15+ 月份同期群組 × 12 個月追蹤期',
        '熱力圖：深色 = 高留存，最佳群組留存率 > 40%',
        '清楚呈現客戶生命週期的自然衰減曲線',
      ],
    },
    {
      step: 4, href: '/basket', icon: ShoppingCart,
      title: t('nav.basket'),
      accentColor: 'text-amber-600', bgColor: 'bg-amber-50/50 dark:bg-amber-950/20',
      description: 'Apriori 關聯規則挖掘 / Association rule mining with interactive filters',
      techStack: ['Apriori', 'FP-Growth', 'mlxtend 0.23'],
      highlights: [
        '88 條關聯規則 · 可調整 min_lift / min_confidence',
        'Support × Confidence × Lift 三指標篩選',
        '最高 Lift 商品組合：禮物包裝類別 (Lift > 40)',
      ],
    },
    {
      step: 5, href: '/recommendations', icon: Star,
      title: t('nav.recommendations'),
      accentColor: 'text-orange-600', bgColor: 'bg-orange-50/50 dark:bg-orange-950/20',
      description: '多策略推薦 · ALS CF · SBERT 語意搜尋 / Multi-strategy recs + semantic search',
      techStack: ['ALS (implicit)', 'SBERT', 'Thompson Bandit', 'Item2Vec'],
      highlights: [
        '協同過濾：ALS 64-dim 潛因子 × 4,338 客戶預快取',
        'SBERT 語意搜尋：輸入自然語言找到最相關商品',
        'Thompson Sampling：5 策略自動優化 CTR',
      ],
    },
    {
      step: 6, href: '/forecast', icon: TrendingUp,
      title: t('nav.forecast'),
      accentColor: 'text-green-600', bgColor: 'bg-green-50/50 dark:bg-green-950/20',
      description: '三模型時序預測 · SARIMA · ETS · LSTM / Three-model time series forecasting',
      techStack: ['SARIMA', 'Holt-Winters ETS', 'PyTorch LSTM', 'statsmodels'],
      highlights: [
        'SARIMA(1,1,1)(0,1,1,7)：MAPE=70%（資料尾段跳躍）',
        'ETS(mul)：MAPE=40%（最佳統計模型）',
        'LSTM 2-layer：MAPE=37%（深度學習最優）',
      ],
    },
    {
      step: 7, href: '/ml-insights', icon: Brain,
      title: t('nav.mlInsights'),
      accentColor: 'text-red-600', bgColor: 'bg-red-50/50 dark:bg-red-950/20',
      description: '流失預測 · CLV 回歸 · Autoencoder 異常偵測 / Churn, CLV, anomaly detection',
      techStack: ['MLP Churn', 'CLV Regression', 'Autoencoder', 'PyTorch'],
      highlights: [
        'Churn Classifier：180 天流失標籤 → AUC=1.0（確定性標籤）',
        'CLV Regressor：預測終身價值 → R²=0.875',
        'Autoencoder：重建誤差異常偵測 → anomaly_rate=0.5%',
      ],
    },
    {
      step: 8, href: '/ab-testing', icon: FlaskConical,
      title: t('nav.abTesting'),
      accentColor: 'text-pink-600', bgColor: 'bg-pink-50/50 dark:bg-pink-950/20',
      description: '完整 A/B 實驗框架 · 統計顯著性 / Full A/B testing framework with stats',
      techStack: ['z-test', 'Welch t-test', "Cohen's d", 'Bonferroni'],
      highlights: [
        '兩比例 z-test：可即時建立實驗、記錄事件',
        '樣本量計算機：輸入 baseline_rate + MDE → 所需樣本數',
        '效果量 + p-value + lift：完整統計報告',
      ],
    },
  ] as TourStepCardProps[]
}

// ── Main component ───────────────────────────────────────────────────────────
export default function TourPage() {
  const { t } = useI18n()
  const { data: registry } = useModelRegistry()
  const { data: overview } = useMetricsOverview()

  const paradigms = getParadigms(t)
  const tourSteps = getTourSteps(t)

  const statCards = [
    { value: overview ? overview.total_orders.toLocaleString() : '397,884', label: t('tour.hero.stats.transactions') },
    { value: overview ? overview.active_customers.toLocaleString() : '4,338', label: t('tour.hero.stats.customers') },
    { value: registry ? String(registry.length) : '11', label: t('tour.hero.stats.models') },
    { value: '9', label: t('tour.hero.stats.pages') },
  ]

  return (
    <div className="space-y-10 max-w-screen-xl pb-12">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border p-8 md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-primary)_0%,_transparent_70%)] opacity-10 pointer-events-none" />
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="flex items-center gap-3">
            <Map className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-black tracking-tight">{t('tour.hero.title')}</h1>
              <p className="text-lg font-semibold text-primary">{t('tour.hero.subtitle')}</p>
            </div>
          </div>
          <p className="text-muted-foreground leading-relaxed">{t('tour.hero.desc')}</p>

          {/* Stat chips */}
          <div className="flex flex-wrap gap-3 pt-2">
            {statCards.map(({ value, label }) => (
              <div key={label} className="rounded-xl border border-border bg-background/80 backdrop-blur-sm px-4 py-2 text-center">
                <p className="text-2xl font-black tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3 pt-2">
            <a
              href="#tour-steps"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              {t('tour.hero.startTour')} ↓
            </a>
            <a
              href={publicPath('/')}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              {t('common.goToPage')}: {t('nav.dashboard')}
            </a>
          </div>
        </div>
      </div>

      {/* ── DATA PIPELINE ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            {t('tour.pipeline.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PipelineTimeline />
          {/* Tech stack summary */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 pt-4 border-t border-border">
            {[
              { icon: Database, label: 'Data Layer', value: 'DuckDB 1.5 · 17 tables · 397K rows' },
              { icon: Cpu,      label: 'ML Stack',   value: 'PyTorch · scikit-learn · statsmodels · gensim' },
              { icon: GitBranch,label: 'API',        value: 'FastAPI 0.138 · Pydantic v2 · 30+ routes' },
              { icon: Activity, label: 'Frontend',   value: 'Next.js 14 · TypeScript · Recharts · shadcn/ui' },
              { icon: Cpu,      label: 'NLP',        value: 'SBERT (all-MiniLM-L6-v2) · TF-IDF · LSA' },
              { icon: Database, label: 'CF',         value: 'ALS (implicit 0.7) · NMF · Item2Vec' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2 p-3 rounded-lg bg-muted/40">
                <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="text-[11px] text-muted-foreground">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── ML PARADIGM MATRIX ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            {t('tour.paradigms.title')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t('tour.paradigms.subtitle')}</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paradigms.map((p) => (
              <MLParadigmCard key={p.paradigm} {...p} />
            ))}
          </div>
          {/* Additional models */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground font-medium mb-3">其他模型 / Additional Models</p>
            <div className="flex flex-wrap gap-2">
              {[
                'SARIMA(1,1,1)(0,1,1,7)', 'Holt-Winters ETS', 'ALS Collaborative Filtering',
                'NMF Recommender', 'TF-IDF + LSA (20 clusters)', 'K-Means RFM Segmentation',
                'Apriori MBA (88 rules)', 'Two-proportion z-test', 'Welch t-test',
              ].map((m) => (
                <span key={m} className="px-2 py-1 rounded-md border bg-muted/30 text-xs">{m}</span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── STEP-BY-STEP TOUR ─────────────────────────────────────────────── */}
      <div id="tour-steps" className="space-y-4">
        <div className="flex items-center gap-2 pb-2">
          <Map className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">{t('tour.steps.title')}</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tourSteps.map((step) => (
            <TourStepCard key={step.step} {...step} />
          ))}
        </div>
      </div>

      {/* ── QUICK REPRODUCE ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            {t('tour.reproduce.title')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t('tour.reproduce.subtitle')}</p>
        </CardHeader>
        <CardContent>
          <QuickReproducePanel />
        </CardContent>
      </Card>

    </div>
  )
}
