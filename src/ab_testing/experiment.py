"""A/B Experiment Management.

提供：實驗建立、事件記錄、統計顯著性計算的完整流程
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

import duckdb

from ab_testing.stats import (
    required_sample_size,
    two_proportion_z_test,
    welch_t_test,
)
from utils.logger import get_logger

log = get_logger(__name__)

EventType = Literal["impression", "click", "conversion"]


@dataclass
class ABExperiment:
    """A/B experiment definition and result container.

    Args:
        name: Human-readable experiment name.
        description: What is being tested.
        variants: List of variant names (first is always 'control').
    """

    name: str
    description: str = ""
    variants: list[str] = field(default_factory=lambda: ["control", "treatment"])
    experiment_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    status: str = "active"

    def __post_init__(self):
        if "control" not in self.variants:
            self.variants = ["control"] + [v for v in self.variants if v != "control"]

    def save(self, conn: duckdb.DuckDBPyConnection) -> None:
        """Persist experiment metadata to DuckDB."""
        import json
        conn.execute("""
            INSERT OR REPLACE INTO ab_experiments
                (experiment_id, name, description, variants, started_at, status)
            VALUES (?, ?, ?, ?, ?, ?)
        """, [
            self.experiment_id,
            self.name,
            self.description,
            json.dumps(self.variants),
            datetime.now(timezone.utc).isoformat(),
            self.status,
        ])
        log.info(f"Experiment '{self.name}' saved (id={self.experiment_id})")

    def record_event(
        self,
        conn: duckdb.DuckDBPyConnection,
        variant: str,
        event_type: EventType,
        user_id: str | None = None,
        value: float = 1.0,
    ) -> None:
        """Log a single A/B event (impression, click, or conversion).

        Args:
            conn: DuckDB connection.
            variant: Which variant the user saw.
            event_type: 'impression', 'click', or 'conversion'.
            user_id: Optional customer identifier.
            value: Numeric value of the event (default 1.0).
        """
        if variant not in self.variants:
            raise ValueError(f"Variant '{variant}' not in {self.variants}")
        conn.execute("""
            INSERT INTO ab_events
                (event_id, experiment_id, variant, user_id, event_type, value, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            str(uuid.uuid4()),
            self.experiment_id,
            variant,
            user_id,
            event_type,
            float(value),
            datetime.now(timezone.utc).isoformat(),
        ])

    def compute_statistics(
        self,
        conn: duckdb.DuckDBPyConnection,
        metric: Literal["conversion_rate", "mean_value"] = "conversion_rate",
        treatment_variant: str | None = None,
        alpha: float = 0.05,
    ) -> dict:
        """Compute statistical significance for control vs. treatment.

        Args:
            conn: DuckDB connection.
            metric: 'conversion_rate' uses z-test; 'mean_value' uses Welch t-test.
            treatment_variant: Which variant to compare against control.
                               Defaults to the second variant.
            alpha: Significance level.

        Returns:
            Dict with all statistical test results.
        """
        treatment = treatment_variant or (
            next((v for v in self.variants if v != "control"), "treatment")
        )
        df = conn.execute("""
            SELECT variant, event_type, value
            FROM ab_events
            WHERE experiment_id = ?
        """, [self.experiment_id]).df()

        if df.empty:
            return {"error": "No events recorded yet."}

        results = {}
        if metric == "conversion_rate":
            def _counts(variant: str):
                v_df = df[df["variant"] == variant]
                impressions = len(v_df[v_df["event_type"] == "impression"])
                conversions = len(v_df[v_df["event_type"] == "conversion"])
                return impressions, conversions

            n_c, conv_c = _counts("control")
            n_t, conv_t = _counts(treatment)
            results = two_proportion_z_test(n_c, n_t, conv_c, conv_t, alpha=alpha)
            results["metric"] = "conversion_rate"
            results["n_control"] = n_c
            results["n_treatment"] = n_t

        elif metric == "mean_value":
            vals_c = df[(df["variant"] == "control")   & (df["event_type"] == "conversion")]["value"].tolist()
            vals_t = df[(df["variant"] == treatment) & (df["event_type"] == "conversion")]["value"].tolist()
            results = welch_t_test(vals_c, vals_t, alpha=alpha)
            results["metric"] = "mean_value"

        results["experiment_id"] = self.experiment_id
        results["control_variant"] = "control"
        results["treatment_variant"] = treatment
        return results

    def sample_size_needed(
        self,
        baseline_rate: float,
        mde: float = 0.01,
        power: float = 0.8,
    ) -> int:
        """Minimum sample size per variant for desired power."""
        return required_sample_size(baseline_rate, mde, power=power)

    @classmethod
    def load(
        cls,
        conn: duckdb.DuckDBPyConnection,
        experiment_id: str,
    ) -> "ABExperiment":
        """Load experiment metadata from DuckDB by ID."""
        import json
        row = conn.execute("""
            SELECT experiment_id, name, description, variants, status
            FROM ab_experiments WHERE experiment_id = ?
        """, [experiment_id]).fetchone()
        if row is None:
            raise ValueError(f"Experiment '{experiment_id}' not found.")
        return cls(
            name=row[1],
            description=row[2] or "",
            variants=json.loads(row[3]),
            experiment_id=row[0],
            status=row[4],
        )
