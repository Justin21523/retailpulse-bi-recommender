"""額外的指標 endpoints：月度收入趨勢、國家分布。"""
from __future__ import annotations

import duckdb
from fastapi import APIRouter, Query

from api.schemas import CountryMetric, MonthlyRevenueItem
from utils.config import get_settings

router = APIRouter()


def _db() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(get_settings().duckdb_path)


@router.get("/revenue/monthly", response_model=list[MonthlyRevenueItem])
def get_monthly_revenue() -> list[MonthlyRevenueItem]:
    """按月聚合收入、訂單數、活躍客戶數，供前端折線圖使用。"""
    conn = _db()
    try:
        rows = conn.execute(
            """
            SELECT
                STRFTIME(date, '%Y-%m')      AS month,
                ROUND(SUM(revenue), 2)       AS revenue,
                SUM(orders)                  AS orders,
                SUM(unique_customers)        AS unique_customers
            FROM daily_sales
            GROUP BY month
            ORDER BY month
            """
        ).fetchall()
        return [
            MonthlyRevenueItem(
                month=r[0],
                revenue=r[1],
                orders=int(r[2]),
                unique_customers=int(r[3]),
            )
            for r in rows
        ]
    finally:
        conn.close()


@router.get("/countries", response_model=list[CountryMetric])
def get_countries(
    limit: int = Query(10, ge=1, le=50, description="回傳前幾名國家"),
) -> list[CountryMetric]:
    """各國收入、訂單、客戶數、AOV 及收入佔比。"""
    conn = _db()
    try:
        # 先算總收入，再計算各國佔比
        total_revenue: float = conn.execute(
            "SELECT SUM(total_amount) FROM invoices"
        ).fetchone()[0] or 1.0

        rows = conn.execute(
            """
            SELECT
                country,
                ROUND(SUM(total_amount), 2)         AS revenue,
                COUNT(*)                             AS orders,
                COUNT(DISTINCT customer_id)          AS customers,
                ROUND(AVG(total_amount), 2)          AS aov
            FROM invoices
            GROUP BY country
            ORDER BY revenue DESC
            LIMIT ?
            """,
            [limit],
        ).fetchall()

        return [
            CountryMetric(
                country=r[0],
                revenue=r[1],
                orders=int(r[2]),
                customers=int(r[3]),
                aov=r[4],
                revenue_pct=round(r[1] / total_revenue * 100, 2),
            )
            for r in rows
        ]
    finally:
        conn.close()
