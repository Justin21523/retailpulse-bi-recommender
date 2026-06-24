"""Tests for features/rfm.py."""
from __future__ import annotations

import duckdb
import pytest

from features.rfm import compute_rfm, score_rfm


def test_rfm_expected_columns(duckdb_conn: duckdb.DuckDBPyConnection) -> None:
    result = compute_rfm(duckdb_conn)
    assert {"customer_id", "recency_days", "frequency", "monetary"}.issubset(result.columns)


def test_rfm_no_null_values(duckdb_conn: duckdb.DuckDBPyConnection) -> None:
    result = compute_rfm(duckdb_conn)
    assert result[["recency_days", "frequency", "monetary"]].isna().sum().sum() == 0


def test_rfm_recency_positive(duckdb_conn: duckdb.DuckDBPyConnection) -> None:
    result = compute_rfm(duckdb_conn)
    assert (result["recency_days"] >= 0).all()


def test_rfm_frequency_positive(duckdb_conn: duckdb.DuckDBPyConnection) -> None:
    result = compute_rfm(duckdb_conn)
    assert (result["frequency"] > 0).all()


def test_score_rfm_adds_score_columns(duckdb_conn: duckdb.DuckDBPyConnection) -> None:
    rfm = compute_rfm(duckdb_conn)
    scored = score_rfm(rfm)
    for col in ["r_score", "f_score", "m_score", "rfm_score"]:
        assert col in scored.columns


def test_rfm_score_is_three_char_string(duckdb_conn: duckdb.DuckDBPyConnection) -> None:
    rfm = compute_rfm(duckdb_conn)
    scored = score_rfm(rfm)
    assert scored["rfm_score"].str.len().eq(3).all()
