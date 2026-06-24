"""ETL orchestrator: raw CSV/XLSX → cleaned → DuckDB tables → features → models."""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

from ingestion.schema import create_all_tables
from preprocessing.cleaner import clean_transactions
from utils.config import get_settings
from utils.db import get_connection
from utils.logger import get_logger

log = get_logger(__name__)


def load_raw(path: str) -> pd.DataFrame:
    """Load raw transaction file (CSV or XLSX).

    Args:
        path: Path to the raw data file.

    Returns:
        Raw DataFrame.
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(
            f"Data file not found: {p}\n"
            "Run 'make sample-data' to generate synthetic data, or\n"
            "download Online Retail UCI from https://archive.ics.uci.edu/dataset/352/online+retail\n"
            "and place it at data/raw/online_retail.xlsx"
        )

    log.info(f"Loading raw data from {p}")
    if p.suffix.lower() in {".xlsx", ".xls"}:
        df = pd.read_excel(path, dtype={"CustomerID": str})
    else:
        df = pd.read_csv(path, dtype={"CustomerID": str})

    log.info(f"Loaded {len(df)} raw rows, {df.shape[1]} columns")
    return df


def build_customers_table(conn, df: pd.DataFrame) -> None:
    """Populate the customers dimension table."""
    cust = (
        df.groupby("CustomerID")
        .agg(
            country=("Country", "first"),
            first_purchase=("InvoiceDate", "min"),
            last_purchase=("InvoiceDate", "max"),
            total_orders=("InvoiceNo", "nunique"),
            total_spend=("line_total", "sum"),
        )
        .reset_index()
        .rename(columns={"CustomerID": "customer_id"})
    )
    cust["first_purchase"] = cust["first_purchase"].dt.date
    cust["last_purchase"] = cust["last_purchase"].dt.date
    conn.execute("DELETE FROM customers")
    conn.register("_cust", cust)
    conn.execute("INSERT INTO customers SELECT * FROM _cust")
    log.info(f"customers table: {len(cust)} rows")


def build_products_table(conn, df: pd.DataFrame) -> None:
    """Populate the products dimension table."""
    prod = (
        df.groupby("StockCode")
        .agg(
            description=("Description", "first"),
            avg_price=("UnitPrice", "mean"),
            total_sold=("Quantity", "sum"),
            total_revenue=("line_total", "sum"),
        )
        .reset_index()
        .rename(columns={"StockCode": "stock_code"})
    )
    conn.execute("DELETE FROM products")
    conn.register("_prod", prod)
    conn.execute("INSERT INTO products SELECT * FROM _prod")
    log.info(f"products table: {len(prod)} rows")


def build_invoices_table(conn, df: pd.DataFrame) -> None:
    """Populate the invoices fact table."""
    inv = (
        df.groupby("InvoiceNo")
        .agg(
            customer_id=("CustomerID", "first"),
            invoice_date=("InvoiceDate", "first"),
            country=("Country", "first"),
            total_amount=("line_total", "sum"),
            item_count=("Quantity", "count"),
        )
        .reset_index()
        .rename(columns={"InvoiceNo": "invoice_no"})
    )
    conn.execute("DELETE FROM invoices")
    conn.register("_inv", inv)
    conn.execute("INSERT INTO invoices SELECT * FROM _inv")
    log.info(f"invoices table: {len(inv)} rows")


def build_invoice_items_table(conn, df: pd.DataFrame) -> None:
    """Populate the invoice_items fact table."""
    items = df[["InvoiceNo", "StockCode", "Quantity", "UnitPrice", "line_total"]].copy()
    items = items.rename(columns={
        "InvoiceNo": "invoice_no",
        "StockCode": "stock_code",
        "Quantity": "quantity",
        "UnitPrice": "unit_price",
    })
    items.insert(0, "id", range(1, len(items) + 1))
    conn.execute("DELETE FROM invoice_items")
    conn.register("_items", items)
    conn.execute("INSERT INTO invoice_items SELECT * FROM _items")
    log.info(f"invoice_items table: {len(items)} rows")


def build_daily_sales_table(conn, df: pd.DataFrame) -> None:
    """Populate the daily_sales aggregate table."""
    daily = df.copy()
    daily["date"] = daily["InvoiceDate"].dt.date
    agg = (
        daily.groupby("date")
        .agg(
            revenue=("line_total", "sum"),
            orders=("InvoiceNo", "nunique"),
            unique_customers=("CustomerID", "nunique"),
            units_sold=("Quantity", "sum"),
        )
        .reset_index()
    )
    conn.execute("DELETE FROM daily_sales")
    conn.register("_daily", agg)
    conn.execute("INSERT INTO daily_sales SELECT * FROM _daily")
    log.info(f"daily_sales table: {len(agg)} rows")


def run_etl(data_path: str | None = None) -> None:
    """Run the full ETL pipeline.

    Args:
        data_path: Path to the input CSV/XLSX file. Defaults to settings value.
    """
    settings = get_settings()
    path = data_path or settings.sample_data_path

    log.info("=" * 60)
    log.info("RetailPulse ETL Pipeline — starting")
    log.info("=" * 60)

    # 1. Load and clean
    raw = load_raw(path)
    df = clean_transactions(raw)

    # 2. Connect and create schema
    conn = get_connection()
    create_all_tables(conn)

    # 3. Core dimension and fact tables
    build_customers_table(conn, df)
    build_products_table(conn, df)
    build_invoices_table(conn, df)
    build_invoice_items_table(conn, df)
    build_daily_sales_table(conn, df)

    # 4. Feature engineering
    log.info("Computing features...")
    from features.rfm import compute_rfm, score_rfm
    from features.product import compute_product_features, save_product_features

    rfm_df = compute_rfm(conn)
    rfm_scored = score_rfm(rfm_df)

    prod_df = compute_product_features(conn)
    save_product_features(conn, prod_df)

    # 5. Models
    log.info("Running models...")
    from models.rfm_segmentation import segment_customers, save_customer_features
    from models.market_basket import build_basket_matrix, run_apriori, save_rules

    segmented = segment_customers(rfm_scored, n_clusters=settings.rfm_n_clusters)
    save_customer_features(conn, segmented)

    basket = build_basket_matrix(conn)
    rules = run_apriori(basket, settings.mba_min_support, settings.mba_min_confidence)
    if not rules.empty:
        save_rules(conn, rules)
        log.info(f"MBA: {len(rules)} association rules saved")
    else:
        log.warning("MBA: No rules found with current thresholds")

    conn.close()
    log.info("=" * 60)
    log.info("ETL Pipeline complete")
    log.info("=" * 60)


if __name__ == "__main__":
    run_etl()
