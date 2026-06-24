"""Cohort retention matrix endpoint。"""
from __future__ import annotations

import duckdb
import numpy as np
from fastapi import APIRouter, HTTPException

from api.schemas import CohortMatrixResponse
from features.cohort import compute_cohort_matrix
from utils.config import get_settings

router = APIRouter()


def _db() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(get_settings().duckdb_path)


@router.get("/matrix", response_model=CohortMatrixResponse)
def get_cohort_matrix() -> CohortMatrixResponse:
    """回傳 cohort 留存率矩陣，供前端熱圖使用。

    matrix[i][j] = cohort i 在第 j 個月的留存率（0~100）。
    null 代表該 cohort 還未進入那個期數（右下角的空白三角）。
    """
    conn = _db()
    try:
        df = compute_cohort_matrix(conn)

        if df.empty:
            raise HTTPException(status_code=503, detail="Cohort data not ready. Run 'make etl' first.")

        # 取出 cohort_month 的 cohort size（Month 0 的 active_users == cohort_size）
        size_sql = """
            WITH cohorts AS (
                SELECT customer_id, DATE_TRUNC('month', MIN(invoice_date)) AS cohort_month
                FROM invoices GROUP BY customer_id
            )
            SELECT CAST(cohort_month AS VARCHAR), COUNT(*) AS size
            FROM cohorts GROUP BY cohort_month ORDER BY cohort_month
        """
        size_rows = conn.execute(size_sql).fetchall()
        size_map: dict[str, int] = {r[0][:7]: int(r[1]) for r in size_rows}

        cohort_months = list(df.index)
        cohort_sizes  = [size_map.get(m[:7], 0) for m in cohort_months]
        periods       = list(df.columns)   # ["Month 0", "Month 1", ...]

        # 把 0 值轉回 None（代表「尚未發生」），用 NaN 判斷不可靠，改用 DataFrame 原始值
        # compute_cohort_matrix 用 fill_value=0，右下角的 0 是「未發生」
        # 但 Month 0 的 0 其實不會出現（一定是 100）
        # 策略：Month 0 以外，如果超過 cohort 的最大觀察期就設 None
        # 簡單起見：留存率 == 0 且 period > 0 → None
        matrix: list[list[float | None]] = []
        for row_label in cohort_months:
            row_vals: list[float | None] = []
            for col in periods:
                val = df.loc[row_label, col]
                if col != "Month 0" and (val == 0.0 or np.isnan(val)):
                    row_vals.append(None)
                else:
                    row_vals.append(round(float(val), 1))
            matrix.append(row_vals)

        return CohortMatrixResponse(
            cohort_months=cohort_months,
            cohort_sizes=cohort_sizes,
            periods=periods,
            matrix=matrix,
        )
    finally:
        conn.close()
