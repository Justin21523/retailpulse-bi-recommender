"""Tests for preprocessing/cleaner.py."""
from __future__ import annotations

import pandas as pd
import pytest

from preprocessing.cleaner import clean_transactions


@pytest.fixture()
def dirty_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "InvoiceNo": ["INV001", "CINV002", "INV003", "INV004", "INV005"],
            "StockCode": ["P001", "P002", "P003", "P004", "P005"],
            "Description": ["Widget A", "Widget B", "Widget C", "Widget D", "Widget E"],
            "Quantity": [2, -1, 3, 0, 5],
            "InvoiceDate": pd.to_datetime(["2023-01-10"] * 5),
            "UnitPrice": [5.0, 10.0, 0.0, 8.0, 6.0],
            "CustomerID": ["C1001", "C1002", None, "C1004", "C1005"],
            "Country": ["United Kingdom"] * 5,
        }
    )


def test_removes_cancelled_orders(dirty_df: pd.DataFrame) -> None:
    result = clean_transactions(dirty_df)
    assert not result["InvoiceNo"].str.startswith("C").any()


def test_removes_null_customer_ids(dirty_df: pd.DataFrame) -> None:
    result = clean_transactions(dirty_df)
    assert result["CustomerID"].isna().sum() == 0


def test_removes_non_positive_quantity(dirty_df: pd.DataFrame) -> None:
    result = clean_transactions(dirty_df)
    assert (result["Quantity"] <= 0).sum() == 0


def test_removes_zero_unit_price(dirty_df: pd.DataFrame) -> None:
    result = clean_transactions(dirty_df)
    assert (result["UnitPrice"] <= 0).sum() == 0


def test_adds_line_total(dirty_df: pd.DataFrame) -> None:
    result = clean_transactions(dirty_df)
    assert "line_total" in result.columns
    expected = result["Quantity"] * result["UnitPrice"]
    pd.testing.assert_series_equal(
        result["line_total"].reset_index(drop=True),
        expected.reset_index(drop=True),
        check_names=False,
    )


def test_clean_data_unchanged(sample_df: pd.DataFrame) -> None:
    """Clean data should pass through without row loss."""
    result = clean_transactions(sample_df)
    assert len(result) == len(sample_df)
