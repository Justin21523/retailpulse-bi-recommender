"""Insights endpoint：自動生成商業洞察。"""
from __future__ import annotations

import duckdb
from fastapi import APIRouter, HTTPException

from analysis.insights import generate_insights
from api.schemas import InsightItem
from utils.config import get_settings

router = APIRouter()


def _db() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(get_settings().duckdb_path)


@router.get("/summary", response_model=list[InsightItem])
def get_insights_summary() -> list[InsightItem]:
    """從資料倉儲自動提取 5 條最重要的商業洞察。

    洞察內容包含：帕累托集中效應、最高峰月份、Champion 消費倍數、
    最強 MBA 規則、At Risk 客群潛在回購價值。
    """
    conn = _db()
    try:
        raw = generate_insights(conn)
        if not raw:
            raise HTTPException(status_code=503, detail="No insights available. Run 'make etl' first.")
        return [
            InsightItem(
                type=i["type"], title=i["title"],
                description=i["description"], value=i["value"], icon=i["icon"],
            )
            for i in raw
        ]
    finally:
        conn.close()
