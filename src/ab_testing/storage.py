"""A/B Testing DuckDB storage helpers."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import duckdb
import pandas as pd

from utils.logger import get_logger

log = get_logger(__name__)


def list_experiments(conn: duckdb.DuckDBPyConnection) -> pd.DataFrame:
    """Return all experiments from DuckDB."""
    return conn.execute("""
        SELECT experiment_id, name, description, variants, status, started_at
        FROM ab_experiments
        ORDER BY started_at DESC
    """).df()


def save_result(
    conn: duckdb.DuckDBPyConnection,
    experiment_id: str,
    result: dict,
) -> None:
    """Persist a statistical result dict to ab_results table."""
    conn.execute("""
        INSERT OR REPLACE INTO ab_results (
            result_id, experiment_id, metric,
            control_variant, treatment_variant,
            control_rate, treatment_rate, p_value,
            effect_size, significant, confidence_level, computed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        str(uuid.uuid4()),
        experiment_id,
        result.get("metric", "conversion_rate"),
        result.get("control_variant", "control"),
        result.get("treatment_variant", "treatment"),
        result.get("control_rate", result.get("mean_a", 0.0)),
        result.get("treatment_rate", result.get("mean_b", 0.0)),
        result.get("p_value", 1.0),
        result.get("effect_size", 0.0),
        bool(result.get("significant", False)),
        0.95,
        datetime.now(timezone.utc).isoformat(),
    ])
    log.info(f"A/B result saved for experiment {experiment_id}")


def get_results(
    conn: duckdb.DuckDBPyConnection,
    experiment_id: str,
) -> pd.DataFrame:
    """Fetch all computed results for an experiment."""
    return conn.execute("""
        SELECT * FROM ab_results WHERE experiment_id = ? ORDER BY computed_at DESC
    """, [experiment_id]).df()
