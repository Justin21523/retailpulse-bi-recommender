"""DuckDB connection factory."""
from __future__ import annotations

from pathlib import Path

import duckdb


def get_connection(path: str | None = None) -> duckdb.DuckDBPyConnection:
    """Return a DuckDB connection.

    Args:
        path: Path to the DuckDB file. Pass ``":memory:"`` for an in-memory DB.
              Defaults to the value in Settings.

    Returns:
        An open DuckDB connection.
    """
    if path is None:
        from utils.config import get_settings
        path = get_settings().duckdb_path

    if path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)

    return duckdb.connect(path)
