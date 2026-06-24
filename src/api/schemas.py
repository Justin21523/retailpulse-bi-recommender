"""Pydantic v2 request/response schemas for the RetailPulse API."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    status: str
    version: str = "0.3.0"
    timestamp: str


class MetricsOverview(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_revenue: float
    total_orders: int
    aov: float
    active_customers: int
    top_country: str


class MonthlyRevenueItem(BaseModel):
    month: str
    revenue: float
    orders: int
    unique_customers: int


class CountryMetric(BaseModel):
    country: str
    revenue: float
    orders: int
    customers: int
    aov: float
    revenue_pct: float


class RFMResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    customer_id: str
    rfm_score: str
    segment: str
    recency_days: int
    frequency: int
    monetary: float
    r_score: int
    f_score: int
    m_score: int
    # 延伸欄位（Phase 2 新增）
    avg_order_value: float = 0.0
    estimated_clv: float = 0.0
    rank_in_segment: int = 0


class CustomerListItem(BaseModel):
    customer_id: str
    segment: str
    rfm_score: str
    recency_days: int
    frequency: int
    monetary: float
    r_score: int
    f_score: int
    m_score: int


class CustomerListResponse(BaseModel):
    items: list[CustomerListItem]
    total: int


class RFMScatterPoint(BaseModel):
    customer_id: str
    recency_days: int
    frequency: int
    monetary: float
    segment: str
    rfm_score: str


class SegmentSummary(BaseModel):
    segment: str
    count: int
    avg_recency: float
    avg_frequency: float
    avg_monetary: float
    total_revenue: float
    revenue_pct: float


class CohortMatrixResponse(BaseModel):
    cohort_months: list[str]
    cohort_sizes: list[int]
    periods: list[str]
    # matrix[i][j] = retention % for cohort i at period j，null 代表還未發生
    matrix: list[list[Optional[float]]]


class MBARule(BaseModel):
    antecedents: str
    consequents: str
    support: float
    confidence: float
    lift: float
    antecedent_description: Optional[str] = None
    consequent_description: Optional[str] = None


class BasketSummary(BaseModel):
    total_rules: int
    avg_lift: float
    max_lift: float
    avg_confidence: float
    avg_support: float


class ProductItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    stock_code: str
    description: str
    total_revenue: float
    order_count: int
    avg_price: float
    popularity_rank: Optional[int] = None


class RecommendationItem(BaseModel):
    stock_code: str
    description: str
    score: float | None = None
    lift: float | None = None
    confidence: float | None = None
    support: float | None = None
    reason: str


class InsightItem(BaseModel):
    type: str
    title: str
    description: str
    value: str
    icon: str
