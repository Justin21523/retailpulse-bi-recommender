"""Cohort retention matrix computation."""
from __future__ import annotations

import duckdb
import pandas as pd

from utils.logger import get_logger

log = get_logger(__name__)


def compute_cohort_matrix(conn: duckdb.DuckDBPyConnection) -> pd.DataFrame:
    """Compute monthly cohort retention matrix.

    Each cell represents the percentage of customers from a cohort who
    made at least one purchase in a given period offset.

    Args:
        conn: Open DuckDB connection with invoices table.

    Returns:
        Pivot DataFrame: rows = cohort_month (YYYY-MM), columns = period_number (0, 1, 2, …),
        values = retention % (0–100).
    """
    sql = """
    WITH cohorts AS (
        SELECT
            customer_id,
            DATE_TRUNC('month', MIN(invoice_date)) AS cohort_month
        FROM invoices
        GROUP BY customer_id
    ),
    activity AS (
        SELECT
            i.customer_id,
            DATE_TRUNC('month', i.invoice_date) AS activity_month
        FROM invoices i
    ),
    joined AS (
        SELECT
            c.customer_id,
            CAST(c.cohort_month AS VARCHAR) AS cohort_month,
            CAST(
                (YEAR(a.activity_month) - YEAR(c.cohort_month)) * 12
                + (MONTH(a.activity_month) - MONTH(c.cohort_month))
            AS INTEGER) AS period_number
        FROM cohorts c
        JOIN activity a ON c.customer_id = a.customer_id
    ),
    sizes AS (
        SELECT cohort_month, COUNT(DISTINCT customer_id) AS cohort_size
        FROM cohorts
        GROUP BY cohort_month
    )
    SELECT
        j.cohort_month,
        j.period_number,
        COUNT(DISTINCT j.customer_id) AS active_users,
        s.cohort_size
    FROM joined j
    JOIN sizes s ON j.cohort_month = s.cohort_month
    WHERE j.period_number >= 0
    GROUP BY j.cohort_month, j.period_number, s.cohort_size
    ORDER BY j.cohort_month, j.period_number
    """
    df = conn.execute(sql).df()

    if df.empty:
        log.warning("Cohort query returned no data")
        return pd.DataFrame()

    df["retention_pct"] = (df["active_users"] / df["cohort_size"] * 100).round(1)

    # Pivot to matrix: cohort_month × period_number
    matrix = df.pivot_table(
        index="cohort_month",
        columns="period_number",
        values="retention_pct",
        fill_value=0,
    )
    matrix.columns = [f"Month {c}" for c in matrix.columns]
    matrix.index.name = "Cohort"

    # Rename first column to "Month 0 (100%)" — always 100 by definition
    log.info(f"Cohort matrix: {matrix.shape[0]} cohorts × {matrix.shape[1]} periods")
    return matrix
