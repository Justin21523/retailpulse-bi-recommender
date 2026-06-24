"""Shared pytest fixtures for RetailPulse tests."""
from __future__ import annotations

import sys
from pathlib import Path

import duckdb
import pandas as pd
import pytest

# Ensure src/ is importable
_ROOT = Path(__file__).resolve().parents[1]
_SRC = _ROOT / "src"
for _p in [str(_ROOT), str(_SRC)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)


@pytest.fixture(scope="function")
def sample_df() -> pd.DataFrame:
    """Minimal clean transactions (no nulls, no returns)."""
    return pd.DataFrame(
        {
            "InvoiceNo": ["INV001"] * 3 + ["INV002"] * 2 + ["INV003"] * 2 + ["INV004"] * 2,
            "StockCode": ["P001", "P002", "P003", "P001", "P004", "P002", "P005", "P001", "P003"],
            "Description": [
                "Widget A", "Widget B", "Widget C",
                "Widget A", "Widget D",
                "Widget B", "Widget E",
                "Widget A", "Widget C",
            ],
            "Quantity": [2, 1, 3, 1, 2, 1, 4, 3, 1],
            "InvoiceDate": pd.to_datetime(
                ["2023-01-10"] * 3
                + ["2023-02-15"] * 2
                + ["2023-03-20"] * 2
                + ["2023-04-05"] * 2
            ),
            "UnitPrice": [5.0, 10.0, 3.0, 5.0, 8.0, 10.0, 6.0, 5.0, 3.0],
            "CustomerID": ["C1001", "C1001", "C1001", "C1002", "C1002", "C1003", "C1003", "C1001", "C1002"],
            "Country": ["United Kingdom"] * 9,
            "line_total": [10.0, 10.0, 9.0, 5.0, 16.0, 10.0, 24.0, 15.0, 3.0],
        }
    )


@pytest.fixture(scope="function")
def duckdb_conn(sample_df: pd.DataFrame) -> duckdb.DuckDBPyConnection:
    """In-memory DuckDB with full schema populated from sample data."""
    conn = duckdb.connect(":memory:")

    from ingestion.schema import create_all_tables
    create_all_tables(conn)

    # Populate invoice_items
    items = sample_df[["InvoiceNo", "StockCode", "Quantity", "UnitPrice", "line_total"]].copy()
    items = items.rename(columns={
        "InvoiceNo": "invoice_no",
        "StockCode": "stock_code",
        "Quantity": "quantity",
        "UnitPrice": "unit_price",
    })
    items.insert(0, "id", range(1, len(items) + 1))
    conn.register("_items", items)
    conn.execute("INSERT INTO invoice_items SELECT * FROM _items")

    # Populate invoices
    inv = (
        sample_df.groupby("InvoiceNo")
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
    conn.register("_inv", inv)
    conn.execute("INSERT INTO invoices SELECT * FROM _inv")

    # Populate products
    prod = (
        sample_df.groupby("StockCode")
        .agg(
            description=("Description", "first"),
            avg_price=("UnitPrice", "mean"),
            total_sold=("Quantity", "sum"),
            total_revenue=("line_total", "sum"),
        )
        .reset_index()
        .rename(columns={"StockCode": "stock_code"})
    )
    conn.register("_prod", prod)
    conn.execute("INSERT INTO products SELECT * FROM _prod")

    yield conn
    conn.close()
