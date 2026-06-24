"""Product feature computation."""
from __future__ import annotations

import duckdb
import pandas as pd

from utils.logger import get_logger

log = get_logger(__name__)


def compute_product_features(conn: duckdb.DuckDBPyConnection) -> pd.DataFrame:
    """Compute per-product aggregates and popularity ranking.

    Args:
        conn: Open DuckDB connection with invoice_items and products tables.

    Returns:
        DataFrame with columns: stock_code, description, total_revenue,
        total_quantity, order_count, avg_price, popularity_rank.
    """
    sql = """
    SELECT
        ii.stock_code,
        p.description,
        SUM(ii.line_total)              AS total_revenue,
        SUM(ii.quantity)                AS total_quantity,
        COUNT(DISTINCT ii.invoice_no)   AS order_count,
        AVG(ii.unit_price)              AS avg_price
    FROM invoice_items ii
    JOIN products p ON ii.stock_code = p.stock_code
    GROUP BY ii.stock_code, p.description
    ORDER BY order_count DESC
    """
    df = conn.execute(sql).df()
    df["popularity_rank"] = range(1, len(df) + 1)
    log.info(f"Product features computed for {len(df)} products")
    return df


def save_product_features(conn: duckdb.DuckDBPyConnection, df: pd.DataFrame) -> None:
    """Persist product features to the product_features warehouse table.

    Args:
        conn: Open DuckDB connection.
        df: DataFrame from :func:`compute_product_features`.
    """
    conn.execute("DELETE FROM product_features")
    conn.register("_pf", df)
    conn.execute("INSERT INTO product_features SELECT * FROM _pf")
    log.info(f"product_features table: {len(df)} rows saved")
