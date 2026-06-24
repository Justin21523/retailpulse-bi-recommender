"""Product endpoints."""
from __future__ import annotations

import duckdb
from fastapi import APIRouter, Query

from api.schemas import ProductItem
from utils.config import get_settings

router = APIRouter()


def _get_db() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(get_settings().duckdb_path)


@router.get("/top", response_model=list[ProductItem])
def get_top_products(n: int = Query(default=10, ge=1, le=100)) -> list[ProductItem]:
    """Return the top N products by order count."""
    conn = _get_db()
    try:
        rows = conn.execute(
            """
            SELECT stock_code, description, total_revenue, order_count, avg_price
            FROM product_features
            ORDER BY popularity_rank
            LIMIT ?
            """,
            [n],
        ).fetchall()

        return [
            ProductItem(
                stock_code=r[0],
                description=r[1],
                total_revenue=round(r[2], 2),
                order_count=r[3],
                avg_price=round(r[4], 2),
            )
            for r in rows
        ]
    finally:
        conn.close()
