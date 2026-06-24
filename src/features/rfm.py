"""RFM (Recency, Frequency, Monetary) feature computation."""
from __future__ import annotations

from datetime import date

import duckdb
import pandas as pd

from utils.logger import get_logger

log = get_logger(__name__)


def compute_rfm(
    conn: duckdb.DuckDBPyConnection,
    snapshot_date: date | None = None,
) -> pd.DataFrame:
    """Compute RFM metrics for each customer.

    Args:
        conn: Open DuckDB connection with invoices and invoice_items tables.
        snapshot_date: Reference date for recency calculation.
                       Defaults to one day after the latest invoice date.

    Returns:
        DataFrame with columns: customer_id, recency_days, frequency, monetary.
    """
    if snapshot_date is None:
        latest = conn.execute(
            "SELECT CAST(MAX(invoice_date) AS DATE) FROM invoices"
        ).fetchone()[0]
        from datetime import timedelta
        snapshot_date = latest + timedelta(days=1)

    sql = f"""
    SELECT
        customer_id,
        CAST(
            DATE_DIFF('day', MAX(CAST(invoice_date AS DATE)), DATE '{snapshot_date}')
        AS INTEGER) AS recency_days,
        COUNT(DISTINCT invoice_no)              AS frequency,
        SUM(total_amount)                       AS monetary
    FROM invoices
    GROUP BY customer_id
    """
    rfm = conn.execute(sql).df()
    rfm = rfm.dropna(subset=["customer_id"])
    log.info(f"RFM computed for {len(rfm)} customers (snapshot: {snapshot_date})")
    return rfm


def score_rfm(rfm_df: pd.DataFrame) -> pd.DataFrame:
    """Add quintile-based R/F/M scores (1–4) and a combined rfm_score string.

    Args:
        rfm_df: DataFrame from :func:`compute_rfm`.

    Returns:
        DataFrame with additional columns: r_score, f_score, m_score, rfm_score.
    """
    df = rfm_df.copy()

    def _qcut(series: pd.Series, ascending: bool = True) -> pd.Series:
        """Robust qcut that handles duplicate bin edges."""
        try:
            labels = [1, 2, 3, 4] if ascending else [4, 3, 2, 1]
            return pd.qcut(series, q=4, labels=labels, duplicates="drop").astype(int)
        except ValueError:
            # Fallback: rank-based scoring when too few unique values
            ranked = series.rank(method="first", ascending=ascending)
            return pd.cut(ranked, bins=4, labels=[1, 2, 3, 4]).astype(int)

    # Lower recency → more recent → higher score
    df["r_score"] = _qcut(df["recency_days"], ascending=False)
    df["f_score"] = _qcut(df["frequency"], ascending=True)
    df["m_score"] = _qcut(df["monetary"], ascending=True)
    df["rfm_score"] = df["r_score"].astype(str) + df["f_score"].astype(str) + df["m_score"].astype(str)

    log.info(f"RFM scores assigned | score range: {df['rfm_score'].min()}–{df['rfm_score'].max()}")
    return df
