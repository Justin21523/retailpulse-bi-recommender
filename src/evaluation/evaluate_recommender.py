"""Evaluate the recommendation engine using temporal hold-out split.

Usage:
    uv run python -m evaluation.evaluate_recommender
"""
from __future__ import annotations

import sys
from pathlib import Path

import duckdb
import pandas as pd

from retrieval.recommender import RetailRecommender
from utils.db import get_connection
from utils.logger import get_logger

log = get_logger(__name__)


def temporal_split(
    conn: duckdb.DuckDBPyConnection,
    train_ratio: float = 0.8,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split invoice_items into train/test sets by invoice date.

    Args:
        conn: Open DuckDB connection with invoice_items and invoices tables.
        train_ratio: Fraction of time range to use for training.

    Returns:
        Tuple of (train_df, test_df) DataFrames with columns:
        invoice_no, stock_code, customer_id, invoice_date.
    """
    sql = """
    SELECT ii.invoice_no, ii.stock_code, i.customer_id, i.invoice_date
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_no = i.invoice_no
    ORDER BY i.invoice_date
    """
    df = conn.execute(sql).df()

    if df.empty:
        raise ValueError("No data found in invoice_items. Run 'make etl' first.")

    dates = df["invoice_date"].sort_values()
    cutoff = dates.quantile(train_ratio)

    train = df[df["invoice_date"] <= cutoff]
    test = df[df["invoice_date"] > cutoff]

    log.info(
        f"Temporal split at {cutoff.date()}: "
        f"train={len(train)} rows ({train['customer_id'].nunique()} customers), "
        f"test={len(test)} rows ({test['customer_id'].nunique()} customers)"
    )
    return train, test


def precision_at_k(recommended: list[str], relevant: set[str], k: int) -> float:
    """Fraction of top-K recommendations that are relevant.

    Args:
        recommended: Ordered list of recommended item IDs.
        relevant: Set of ground-truth relevant item IDs.
        k: Cutoff rank.

    Returns:
        Precision@K in [0, 1].
    """
    if not recommended or k == 0:
        return 0.0
    top_k = recommended[:k]
    hits = sum(1 for item in top_k if item in relevant)
    return hits / k


def recall_at_k(recommended: list[str], relevant: set[str], k: int) -> float:
    """Fraction of relevant items recovered in top-K recommendations.

    Args:
        recommended: Ordered list of recommended item IDs.
        relevant: Set of ground-truth relevant item IDs.
        k: Cutoff rank.

    Returns:
        Recall@K in [0, 1].
    """
    if not relevant or k == 0:
        return 0.0
    top_k = recommended[:k]
    hits = sum(1 for item in top_k if item in relevant)
    return hits / len(relevant)


def coverage(all_recs: list[list[str]], catalog_size: int) -> float:
    """Fraction of the product catalog that appears in at least one recommendation list.

    Args:
        all_recs: List of recommendation lists.
        catalog_size: Total number of products in the catalog.

    Returns:
        Coverage in [0, 1].
    """
    if catalog_size == 0:
        return 0.0
    unique_recommended = len({item for rec_list in all_recs for item in rec_list})
    return unique_recommended / catalog_size


def evaluate(
    conn: duckdb.DuckDBPyConnection | None = None,
    k: int = 10,
) -> dict:
    """Run end-to-end evaluation of the recommendation engine.

    Args:
        conn: Open DuckDB connection. Opens from settings if None.
        k: Top-K cutoff for precision and recall.

    Returns:
        Dict with keys: precision_at_k, recall_at_k, coverage, n_customers, k.
    """
    if conn is None:
        conn = get_connection()

    train, test = temporal_split(conn)

    # Build a train-only DuckDB in memory for the recommender
    train_conn = duckdb.connect(":memory:")
    from ingestion.schema import create_all_tables
    create_all_tables(train_conn)

    # Populate invoice_items and invoices from train data
    train_items = train[["invoice_no", "stock_code"]].copy()
    train_items["quantity"] = 1
    train_items["unit_price"] = 1.0
    train_items["line_total"] = 1.0
    train_items.insert(0, "id", range(1, len(train_items) + 1))
    train_conn.register("_ti", train_items)
    train_conn.execute("INSERT INTO invoice_items SELECT * FROM _ti")

    train_inv = (
        train.groupby("invoice_no")
        .agg(customer_id=("customer_id", "first"), invoice_date=("invoice_date", "first"),
             country=("customer_id", "count"), total_amount=("stock_code", "count"),
             item_count=("stock_code", "count"))
        .reset_index()
    )
    train_inv["country"] = "Unknown"
    train_conn.register("_tinv", train_inv)
    train_conn.execute("INSERT INTO invoices SELECT * FROM _tinv")

    # Populate product_features with all-products popularity (from main conn)
    prod_sql = "SELECT * FROM product_features"
    prod_df = conn.execute(prod_sql).df()
    if not prod_df.empty:
        train_conn.register("_pf", prod_df)
        train_conn.execute("INSERT INTO product_features SELECT * FROM _pf")

    # Populate mba_rules from main conn
    rules_sql = "SELECT * FROM mba_rules"
    rules_df = conn.execute(rules_sql).df()
    if not rules_df.empty:
        train_conn.register("_rules", rules_df)
        train_conn.execute("INSERT INTO mba_rules SELECT * FROM _rules")

    recommender = RetailRecommender(train_conn)

    # Evaluate per customer in test set
    test_customers = test["customer_id"].unique()
    catalog_size = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]

    precision_scores: list[float] = []
    recall_scores: list[float] = []
    all_recs: list[list[str]] = []

    for cid in test_customers:
        relevant = set(test[test["customer_id"] == cid]["stock_code"].tolist())
        recs = recommender.recommend_for_customer(cid, n=k)
        rec_codes = [r["stock_code"] for r in recs]

        precision_scores.append(precision_at_k(rec_codes, relevant, k))
        recall_scores.append(recall_at_k(rec_codes, relevant, k))
        all_recs.append(rec_codes)

    metrics = {
        "precision_at_k": round(sum(precision_scores) / len(precision_scores), 4) if precision_scores else 0.0,
        "recall_at_k": round(sum(recall_scores) / len(recall_scores), 4) if recall_scores else 0.0,
        "coverage": round(coverage(all_recs, catalog_size), 4),
        "n_customers": len(test_customers),
        "k": k,
    }

    log.info("=" * 50)
    log.info("Evaluation Results")
    log.info("=" * 50)
    log.info(f"  Customers evaluated : {metrics['n_customers']}")
    log.info(f"  Precision@{k}         : {metrics['precision_at_k']:.4f}")
    log.info(f"  Recall@{k}            : {metrics['recall_at_k']:.4f}")
    log.info(f"  Coverage            : {metrics['coverage']:.4f} ({metrics['coverage']*100:.1f}% of {catalog_size} products)")
    log.info("=" * 50)

    train_conn.close()
    return metrics


if __name__ == "__main__":
    evaluate()
