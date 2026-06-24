'use client'

import { X, GitFork, Database, Cpu, FlaskConical, BarChart3, Users, TrendingUp } from 'lucide-react'

interface AboutModalProps {
  open: boolean
  onClose: () => void
}

const TECH_STACK = [
  'Next.js 14 App Router',
  'FastAPI + Python',
  'DuckDB (in-process OLAP)',
  'PyTorch (MLP / Autoencoder)',
  'Recharts',
  'Tailwind v4',
]

const ML_CAPABILITIES = [
  { icon: Users,      label: 'RFM 客戶分群',  desc: 'K-Means · 4,338 位客戶 → 4 族群' },
  { icon: TrendingUp, label: '流失預測',       desc: 'MLP 分類器 · AUC-ROC > 0.85' },
  { icon: Cpu,        label: 'CLV 回歸',       desc: 'MLP 回歸 · 預測終身消費價值' },
  { icon: FlaskConical, label: '異常偵測',     desc: 'Autoencoder · 重建誤差 > μ+2σ' },
  { icon: BarChart3,  label: '時序預測',       desc: 'SARIMA · ETS · LSTM' },
  { icon: Database,   label: 'A/B 測試引擎',   desc: 'Z-test · Thompson Sampling Bandit' },
]

const PIPELINE_STEPS = ['CSV', 'ETL', 'DuckDB', '11 Models', 'REST API', 'Dashboard']

export function AboutModal({ open, onClose }: AboutModalProps) {
  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 pb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">RetailPulse BI</h2>
              <p className="text-sm text-muted-foreground mt-1">
                零售智慧分析平台 · UCI Online Retail Dataset
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 pb-6 space-y-5">
            {/* Dataset Info */}
            <div className="rounded-xl bg-muted/50 p-4 text-sm space-y-1">
              <p className="font-semibold text-foreground">資料集</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                UCI Online Retail II — 英國線上零售商，2009–2011 年共 541,909 筆交易紀錄，
                涵蓋 4,338 位客戶、25,900 張發票，總營收 £891 萬。
              </p>
            </div>

            {/* Tech Stack */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Tech Stack</p>
              <div className="flex flex-wrap gap-1.5">
                {TECH_STACK.map((t) => (
                  <span key={t} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* ML Capabilities */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">ML Capabilities</p>
              <div className="grid grid-cols-2 gap-2">
                {ML_CAPABILITIES.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-2.5 rounded-lg border border-border p-3">
                    <Icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Data Pipeline</p>
              <div className="flex items-center gap-1 flex-wrap text-xs">
                {PIPELINE_STEPS.map((step, i) => (
                  <span key={step} className="flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">{step}</span>
                    {i < PIPELINE_STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
                  </span>
                ))}
              </div>
            </div>

            {/* GitHub placeholder */}
            <a
              href="#"
              className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium text-muted-foreground"
              onClick={(e) => e.preventDefault()}
            >
              <GitFork className="w-4 h-4" />
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
