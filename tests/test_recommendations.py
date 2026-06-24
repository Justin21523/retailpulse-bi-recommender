"""Tests for retrieval/recommender.py."""
from __future__ import annotations

import duckdb
import pytest

from features.product import compute_product_features, save_product_features
from retrieval.recommender import RetailRecommender


@pytest.fixture()
def conn_with_features(duckdb_conn: duckdb.DuckDBPyConnection) -> duckdb.DuckDBPyConnection:
    """DuckDB connection with product_features populated."""
    prod_df = compute_product_features(duckdb_conn)
    save_product_features(duckdb_conn, prod_df)
    return duckdb_conn


def test_popularity_returns_list(conn_with_features: duckdb.DuckDBPyConnection) -> None:
    rec = RetailRecommender(conn_with_features)
    result = rec.recommend_by_popularity(n=5)
    assert isinstance(result, list)


def test_popularity_returns_n_items(conn_with_features: duckdb.DuckDBPyConnection) -> None:
    rec = RetailRecommender(conn_with_features)
    result = rec.recommend_by_popularity(n=3)
    assert len(result) == 3


def test_popularity_items_have_required_keys(conn_with_features: duckdb.DuckDBPyConnection) -> None:
    rec = RetailRecommender(conn_with_features)
    result = rec.recommend_by_popularity(n=5)
    for item in result:
        assert "stock_code" in item
        assert "description" in item
        assert "reason" in item


def test_customer_recommendation_returns_list(conn_with_features: duckdb.DuckDBPyConnection) -> None:
    rec = RetailRecommender(conn_with_features)
    result = rec.recommend_for_customer("C1001", n=5)
    assert isinstance(result, list)


def test_customer_recommendation_length_bounded(conn_with_features: duckdb.DuckDBPyConnection) -> None:
    rec = RetailRecommender(conn_with_features)
    result = rec.recommend_for_customer("C1001", n=3)
    assert len(result) <= 3


def test_unknown_customer_returns_popularity(conn_with_features: duckdb.DuckDBPyConnection) -> None:
    rec = RetailRecommender(conn_with_features)
    result = rec.recommend_for_customer("UNKNOWN_XYZ_999", n=3)
    # Should not raise; falls back to popularity
    assert isinstance(result, list)
