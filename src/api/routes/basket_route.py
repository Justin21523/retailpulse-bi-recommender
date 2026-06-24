"""Market basket analysis endpoints：規則列表與統計摘要。"""
from __future__ import annotations

import duckdb
from fastapi import APIRouter, Query

from api.schemas import BasketSummary, MBARule
from utils.config import get_settings

router = APIRouter()


def _db() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(get_settings().duckdb_path)


@router.get("/rules", response_model=list[MBARule])
def get_basket_rules(
    min_lift: float = Query(1.0, ge=0.0, description="Lift 下限"),
    min_confidence: float = Query(0.1, ge=0.0, le=1.0, description="Confidence 下限"),
    limit: int = Query(100, ge=1, le=500),
) -> list[MBARule]:
    """回傳 MBA 關聯規則，依 lift 降冪排序，可用 min_lift / min_confidence 篩選。

    抓取商品描述時做 LEFT JOIN——若 antecedents / consequents 是組合品項
    （逗號分隔），則 description 可能為 null，前端自行 fallback。
    """
    conn = _db()
    try:
        rows = conn.execute(
            """
            SELECT
                r.antecedents,
                r.consequents,
                ROUND(r.support, 5)    AS support,
                ROUND(r.confidence, 4) AS confidence,
                ROUND(r.lift, 3)       AS lift,
                p1.description         AS ant_desc,
                p2.description         AS con_desc
            FROM mba_rules r
            LEFT JOIN products p1 ON r.antecedents  = p1.stock_code
            LEFT JOIN products p2 ON r.consequents  = p2.stock_code
            WHERE r.lift       >= ?
              AND r.confidence >= ?
            ORDER BY r.lift DESC
            LIMIT ?
            """,
            [min_lift, min_confidence, limit],
        ).fetchall()

        return [
            MBARule(
                antecedents=r[0], consequents=r[1],
                support=float(r[2]), confidence=float(r[3]), lift=float(r[4]),
                antecedent_description=r[5], consequent_description=r[6],
            )
            for r in rows
        ]
    finally:
        conn.close()


@router.get("/summary", response_model=BasketSummary)
def get_basket_summary() -> BasketSummary:
    """MBA 整體統計：規則總數、平均 lift / confidence / support。"""
    conn = _db()
    try:
        row = conn.execute(
            """
            SELECT
                COUNT(*)            AS total_rules,
                ROUND(AVG(lift), 3) AS avg_lift,
                ROUND(MAX(lift), 3) AS max_lift,
                ROUND(AVG(confidence), 4) AS avg_confidence,
                ROUND(AVG(support), 5)    AS avg_support
            FROM mba_rules
            """
        ).fetchone()

        return BasketSummary(
            total_rules=int(row[0]),
            avg_lift=float(row[1]),
            max_lift=float(row[2]),
            avg_confidence=float(row[3]),
            avg_support=float(row[4]),
        )
    finally:
        conn.close()
