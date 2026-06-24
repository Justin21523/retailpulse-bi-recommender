"""Customer endpoints."""
from __future__ import annotations

import duckdb
from fastapi import APIRouter, HTTPException

from api.schemas import RFMResult
from utils.config import get_settings

router = APIRouter()


def _get_db() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(get_settings().duckdb_path)


@router.get("/{customer_id}/rfm", response_model=RFMResult)
def get_customer_rfm(customer_id: str) -> RFMResult:
    """Return RFM metrics, segment, CLV estimate and segment rank for a specific customer."""
    conn = _get_db()
    try:
        row = conn.execute(
            """
            SELECT customer_id, recency_days, frequency, monetary,
                   r_score, f_score, m_score, rfm_score, segment
            FROM customer_features
            WHERE customer_id = ?
            """,
            [customer_id],
        ).fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail=f"Customer '{customer_id}' not found. Run 'make etl' first.",
            )

        cust_id, recency, frequency, monetary, r, f, m, rfm_score, segment = row
        avg_order_value = round(float(monetary) / max(int(frequency), 1), 2)

        # 簡易 CLV：平均客單 × 頻次 × 活躍係數（recency 越近係數越高）
        recency_factor = max(0.1, 1.0 - float(recency) / 365.0 * 0.5)
        estimated_clv  = round(avg_order_value * int(frequency) * recency_factor, 2)

        # 在同 segment 中按 monetary 的名次（1-based）
        rank_row = conn.execute(
            """
            SELECT COUNT(*) + 1
            FROM customer_features
            WHERE segment = ? AND monetary > ?
            """,
            [segment, float(monetary)],
        ).fetchone()
        rank_in_segment = int(rank_row[0]) if rank_row else 0

        return RFMResult(
            customer_id=cust_id,
            recency_days=int(recency),
            frequency=int(frequency),
            monetary=round(float(monetary), 2),
            r_score=int(r), f_score=int(f), m_score=int(m),
            rfm_score=rfm_score, segment=segment,
            avg_order_value=avg_order_value,
            estimated_clv=estimated_clv,
            rank_in_segment=rank_in_segment,
        )
    finally:
        conn.close()
