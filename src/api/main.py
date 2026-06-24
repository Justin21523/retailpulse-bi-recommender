"""RetailPulse FastAPI application."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import (
    ab_route,
    basket_route,
    cf_route,
    cohort_route,
    customers,
    customers_list,
    forecast_route,
    health,
    insights_route,
    metrics,
    metrics_detail,
    ml_route,
    nlp_route,
    products,
    recommendations,
    tree_route,
    upload_route,
)

app = FastAPI(
    title="RetailPulse BI API",
    description=(
        "Retail analytics and recommendation engine — ETL, DuckDB, RFM, "
        "cohort retention, market basket analysis, collaborative filtering, "
        "deep learning, NLP, time-series forecasting, A/B testing."
    ),
    version="0.3.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],  # Next.js preflight 需要 OPTIONS
    allow_headers=["*"],
)


# ── 既有 routes ────────────────────────────────────────────────────────────
app.include_router(health.router, tags=["health"])
app.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
app.include_router(customers.router, prefix="/customers", tags=["customers"])
app.include_router(products.router, prefix="/products", tags=["products"])
app.include_router(recommendations.router, prefix="/recommendations", tags=["recommendations"])

# ── Phase 2 新增 routes ────────────────────────────────────────────────────
# 注意：靜態前綴路由須在同前綴的動態路由之前 include，此處各自獨立前綴不衝突
app.include_router(metrics_detail.router, prefix="/metrics", tags=["metrics"])
app.include_router(customers_list.router, tags=["customers"])
app.include_router(cohort_route.router, prefix="/cohort", tags=["cohort"])
app.include_router(basket_route.router, prefix="/basket", tags=["basket"])
app.include_router(insights_route.router, prefix="/insights", tags=["insights"])

# ── Phase 4 新增 routes ────────────────────────────────────────────────────
app.include_router(forecast_route.router, tags=["forecast"])
app.include_router(ml_route.router, tags=["ml"])
app.include_router(cf_route.router, tags=["collaborative-filtering"])
app.include_router(nlp_route.router, tags=["nlp"])
app.include_router(ab_route.router, tags=["ab-testing"])
app.include_router(tree_route.router, tags=["tree-ml"])

# ── Phase 13C 新增 routes ──────────────────────────────────────────────────
app.include_router(upload_route.router, tags=["upload"])
