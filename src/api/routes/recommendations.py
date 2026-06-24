"""Recommendation endpoints."""
from __future__ import annotations

import duckdb
from fastapi import APIRouter, Query

from api.schemas import RecommendationItem
from retrieval.recommender import RetailRecommender
from utils.config import get_settings

router = APIRouter()


def _get_db() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(get_settings().duckdb_path)


@router.get("/customer/{customer_id}", response_model=list[RecommendationItem])
def recommend_for_customer(
    customer_id: str,
    n: int = Query(default=10, ge=1, le=50),
) -> list[RecommendationItem]:
    """Return top-N product recommendations for a customer."""
    conn = _get_db()
    try:
        rec = RetailRecommender(conn)
        items = rec.recommend_for_customer(customer_id, n=n)
        return [
            RecommendationItem(
                stock_code=item["stock_code"],
                description=item.get("description", ""),
                score=item.get("score"),
                lift=item.get("lift"),
                confidence=item.get("confidence"),
                reason=item.get("reason", "popularity"),
            )
            for item in items
        ]
    finally:
        conn.close()


@router.get("/product/{stock_code}", response_model=list[RecommendationItem])
def recommend_for_product(
    stock_code: str,
    n: int = Query(default=10, ge=1, le=50),
) -> list[RecommendationItem]:
    """Return top-N products frequently bought together with a given product."""
    conn = _get_db()
    try:
        rec = RetailRecommender(conn)
        items = rec.recommend_for_product(stock_code, n=n)
        return [
            RecommendationItem(
                stock_code=item["stock_code"],
                description=item.get("description", ""),
                score=item.get("score"),
                lift=item.get("lift"),
                confidence=item.get("confidence"),
                reason=item.get("reason", "popularity"),
            )
            for item in items
        ]
    finally:
        conn.close()
