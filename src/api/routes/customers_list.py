"""客戶列表、RFM scatter、segment 統計 endpoints。"""
from __future__ import annotations

from typing import Literal

import duckdb
from fastapi import APIRouter, Query

from api.schemas import (
    CustomerListItem,
    CustomerListResponse,
    RFMScatterPoint,
    SegmentSummary,
)
from utils.config import get_settings

router = APIRouter()

_SORT_COLUMNS: dict[str, str] = {
    "monetary":     "monetary DESC",
    "frequency":    "frequency DESC",
    "recency":      "recency_days ASC",   # 越小越近期，升冪
}


def _db() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(get_settings().duckdb_path)


@router.get("/customers", response_model=CustomerListResponse)
def list_customers(
    segment: str | None = Query(None, description="篩選分群（Champions / Loyal Customers / At Risk / Lost）"),
    q: str | None = Query(None, description="依 customer_id 模糊搜尋"),
    sort_by: Literal["monetary", "frequency", "recency"] = Query("monetary"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> CustomerListResponse:
    """回傳可分頁的客戶列表，支援按分群篩選和排序。"""
    order_clause = _SORT_COLUMNS.get(sort_by, "monetary DESC")
    conn = _db()
    try:
        where_parts: list[str] = []
        params_filter: list[str] = []
        if segment:
            where_parts.append("segment = ?")
            params_filter.append(segment)
        if q:
            where_parts.append("customer_id ILIKE ?")
            params_filter.append(f"%{q.strip()}%")
        where = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

        total_row = conn.execute(
            f"SELECT COUNT(*) FROM customer_features {where}", params_filter
        ).fetchone()
        total = int(total_row[0])

        rows = conn.execute(
            f"""
            SELECT customer_id, segment, rfm_score,
                   recency_days, frequency, monetary,
                   r_score, f_score, m_score
            FROM customer_features
            {where}
            ORDER BY {order_clause}
            LIMIT ? OFFSET ?
            """,
            params_filter + [limit, offset],
        ).fetchall()

        items = [
            CustomerListItem(
                customer_id=r[0], segment=r[1], rfm_score=r[2],
                recency_days=int(r[3]), frequency=int(r[4]),
                monetary=round(float(r[5]), 2),
                r_score=int(r[6]), f_score=int(r[7]), m_score=int(r[8]),
            )
            for r in rows
        ]
        return CustomerListResponse(items=items, total=total)
    finally:
        conn.close()


@router.get("/rfm/scatter", response_model=list[RFMScatterPoint])
def get_rfm_scatter() -> list[RFMScatterPoint]:
    """回傳所有客戶的 RFM 座標，供前端散佈圖使用（~400KB JSON）。"""
    conn = _db()
    try:
        rows = conn.execute(
            """
            SELECT customer_id, recency_days, frequency,
                   monetary, segment, rfm_score
            FROM customer_features
            ORDER BY monetary DESC
            """
        ).fetchall()
        return [
            RFMScatterPoint(
                customer_id=r[0], recency_days=int(r[1]),
                frequency=int(r[2]), monetary=round(float(r[3]), 2),
                segment=r[4], rfm_score=r[5],
            )
            for r in rows
        ]
    finally:
        conn.close()


@router.get("/rfm/segments", response_model=list[SegmentSummary])
def get_rfm_segments() -> list[SegmentSummary]:
    """各 RFM 分群的統計摘要：人數、平均 R/F/M、總收入、收入佔比。"""
    conn = _db()
    try:
        total_rev: float = conn.execute(
            "SELECT SUM(monetary) FROM customer_features"
        ).fetchone()[0] or 1.0

        rows = conn.execute(
            """
            SELECT
                segment,
                COUNT(*)                    AS cnt,
                ROUND(AVG(recency_days), 1) AS avg_recency,
                ROUND(AVG(frequency), 1)    AS avg_frequency,
                ROUND(AVG(monetary), 2)     AS avg_monetary,
                ROUND(SUM(monetary), 2)     AS total_revenue
            FROM customer_features
            GROUP BY segment
            ORDER BY total_revenue DESC
            """
        ).fetchall()

        return [
            SegmentSummary(
                segment=r[0], count=int(r[1]),
                avg_recency=float(r[2]), avg_frequency=float(r[3]),
                avg_monetary=float(r[4]), total_revenue=float(r[5]),
                revenue_pct=round(float(r[5]) / total_rev * 100, 2),
            )
            for r in rows
        ]
    finally:
        conn.close()
