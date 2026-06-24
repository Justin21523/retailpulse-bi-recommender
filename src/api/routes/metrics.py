"""Business metrics endpoints."""
from __future__ import annotations

import duckdb
from fastapi import APIRouter, Depends, HTTPException

from api.schemas import MetricsOverview
from utils.config import get_settings

router = APIRouter()


def _get_db() -> duckdb.DuckDBPyConnection:
    """Open a read-only DuckDB connection for each request."""
    conn = duckdb.connect(get_settings().duckdb_path)
    return conn


@router.get("/overview", response_model=MetricsOverview)
def get_overview() -> MetricsOverview:
    """Return top-level revenue and customer KPIs."""
    conn = _get_db()
    try:
        row = conn.execute("""
            SELECT
                COALESCE(SUM(total_amount), 0)              AS total_revenue,
                COUNT(*)                                     AS total_orders,
                COALESCE(SUM(total_amount) / NULLIF(COUNT(*), 0), 0) AS aov,
                COUNT(DISTINCT customer_id)                  AS active_customers
            FROM invoices
        """).fetchone()

        if row is None or row[1] == 0:
            raise HTTPException(
                status_code=503,
                detail="No data available. Run 'make etl' to populate the database.",
            )

        top_row = conn.execute("""
            SELECT country FROM invoices
            GROUP BY country ORDER BY COUNT(*) DESC LIMIT 1
        """).fetchone()
        top_country = top_row[0] if top_row else "Unknown"

        return MetricsOverview(
            total_revenue=round(row[0], 2),
            total_orders=row[1],
            aov=round(row[2], 2),
            active_customers=row[3],
            top_country=top_country,
        )
    finally:
        conn.close()
