"""Tests for models/market_basket.py."""
from __future__ import annotations

import duckdb
import pandas as pd
import pytest

from models.market_basket import build_basket_matrix, run_apriori


def test_basket_matrix_is_boolean(duckdb_conn: duckdb.DuckDBPyConnection) -> None:
    basket = build_basket_matrix(duckdb_conn)
    assert basket.dtypes.apply(lambda dt: dt == bool).all()


def test_basket_matrix_shape(duckdb_conn: duckdb.DuckDBPyConnection) -> None:
    basket = build_basket_matrix(duckdb_conn)
    # At least 1 row (invoice) and 1 column (product)
    assert basket.shape[0] >= 1
    assert basket.shape[1] >= 1


def test_apriori_returns_dataframe(duckdb_conn: duckdb.DuckDBPyConnection) -> None:
    basket = build_basket_matrix(duckdb_conn)
    # Very low support to get at least some rules from the small test dataset
    result = run_apriori(basket, min_support=0.1, min_confidence=0.01)
    assert isinstance(result, pd.DataFrame)


def test_apriori_rule_columns(duckdb_conn: duckdb.DuckDBPyConnection) -> None:
    basket = build_basket_matrix(duckdb_conn)
    result = run_apriori(basket, min_support=0.1, min_confidence=0.01)
    if not result.empty:
        required_cols = {"antecedents", "consequents", "support", "confidence", "lift"}
        assert required_cols.issubset(result.columns)


def test_apriori_lift_positive(duckdb_conn: duckdb.DuckDBPyConnection) -> None:
    basket = build_basket_matrix(duckdb_conn)
    result = run_apriori(basket, min_support=0.1, min_confidence=0.01)
    if not result.empty:
        assert (result["lift"] > 0).all()
