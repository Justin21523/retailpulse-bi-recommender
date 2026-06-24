"""Data cleaning functions for raw retail transaction data."""
from __future__ import annotations

import pandas as pd

from utils.logger import get_logger

log = get_logger(__name__)


def clean_transactions(df: pd.DataFrame) -> pd.DataFrame:
    """Clean raw transaction data.

    Removes:
    - Cancelled orders (InvoiceNo starting with 'C')
    - Rows with null CustomerID
    - Rows with Quantity <= 0 or UnitPrice <= 0
    - Rows with null StockCode or Description

    Args:
        df: Raw DataFrame with Online Retail UCI schema.

    Returns:
        Cleaned DataFrame with additional ``line_total`` column.
    """
    n_raw = len(df)

    # Remove cancelled invoices
    mask_cancelled = df["InvoiceNo"].astype(str).str.startswith("C")
    df = df[~mask_cancelled].copy()
    log.info(f"Removed {mask_cancelled.sum()} cancelled rows")

    # Remove null CustomerID
    mask_null_cust = df["CustomerID"].isna()
    df = df[~mask_null_cust].copy()
    log.info(f"Removed {mask_null_cust.sum()} rows with null CustomerID")

    # Remove invalid quantity / price
    mask_bad_qty = df["Quantity"] <= 0
    mask_bad_price = df["UnitPrice"] <= 0
    df = df[~mask_bad_qty & ~mask_bad_price].copy()
    log.info(f"Removed {(mask_bad_qty | mask_bad_price).sum()} rows with invalid Quantity/UnitPrice")

    # Remove null StockCode or Description
    df = df.dropna(subset=["StockCode", "Description"])

    # Type coercions
    df["CustomerID"] = df["CustomerID"].astype(str).str.strip()
    df["StockCode"] = df["StockCode"].astype(str).str.strip()
    df["Description"] = df["Description"].astype(str).str.strip()
    df["InvoiceDate"] = pd.to_datetime(df["InvoiceDate"])
    df["Quantity"] = df["Quantity"].astype(int)
    df["UnitPrice"] = df["UnitPrice"].astype(float)

    # Derived column
    df["line_total"] = df["Quantity"] * df["UnitPrice"]

    log.info(f"Cleaned: {n_raw} → {len(df)} rows ({len(df)/n_raw*100:.1f}% retained)")
    return df.reset_index(drop=True)
