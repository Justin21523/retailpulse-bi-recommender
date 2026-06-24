"""Training script for Time-Series Forecasting models.

make train-ts → SARIMA + ETS → sales_forecasts table (30 days ahead)
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import pandas as pd

from models.timeseries.ets_forecaster import ETSForecaster
from models.timeseries.sarima_forecaster import SARIMAForecaster
from utils.db import get_connection
from utils.logger import get_logger

log = get_logger(__name__)


def _store_forecast(conn, df: pd.DataFrame) -> None:
    """Delete old forecasts for this model and insert new ones."""
    model_name = df["model_name"].iloc[0]
    conn.execute("DELETE FROM sales_forecasts WHERE model_name = ?", [model_name])
    conn.register("_forecast", df)
    conn.execute("INSERT INTO sales_forecasts (date, predicted_revenue, lower_ci, upper_ci, model_name, horizon_days) SELECT date, predicted_revenue, lower_ci, upper_ci, model_name, horizon_days FROM _forecast")
    log.info(f"Stored {len(df)} forecast rows for model={model_name}")


def main() -> None:
    conn = get_connection()
    log.info("=== Training Time-Series Forecasting Models ===")

    # ── SARIMA ────────────────────────────────────────────────────────────────
    try:
        log.info("Training SARIMA...")
        sarima = SARIMAForecaster()
        sarima.fit(conn)
        sarima.save()
        forecast_df = sarima.forecast(steps=30)
        _store_forecast(conn, forecast_df)

        metrics = {
            "mape": round(sarima.mape_, 4) if sarima.mape_ else None,
            "aic": round(sarima.aic_, 2) if sarima.aic_ else None,
            "bic": round(sarima.bic_, 2) if sarima.bic_ else None,
        }
        conn.execute("""
            INSERT OR REPLACE INTO model_registry
                (model_id, model_name, model_type, metrics, artifact_path, trained_at, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            "sarima_v1", "sarima_forecaster", "time_series",
            json.dumps(metrics), "data/models/sarima_model.pkl",
            datetime.now(timezone.utc).isoformat(),
            "SARIMA(1,1,1)(0,1,1,7) — weekly seasonal daily revenue forecast",
        ])
        log.info(f"SARIMA metrics: {metrics}")
    except Exception as e:
        log.warning(f"SARIMA training failed (possibly insufficient data): {e}")

    # ── ETS ───────────────────────────────────────────────────────────────────
    try:
        log.info("Training ETS (Holt-Winters)...")
        ets = ETSForecaster()
        ets.fit(conn)
        ets.save()
        forecast_df = ets.forecast(steps=30)
        _store_forecast(conn, forecast_df)

        metrics = {
            "mape": round(ets.mape_, 4) if ets.mape_ else None,
            "aic": round(ets.aic_, 2) if ets.aic_ else None,
            "seasonal_type": ets._seasonal_type,
        }
        conn.execute("""
            INSERT OR REPLACE INTO model_registry
                (model_id, model_name, model_type, metrics, artifact_path, trained_at, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            "ets_v1", "ets_forecaster", "time_series",
            json.dumps(metrics), "data/models/ets_model.pkl",
            datetime.now(timezone.utc).isoformat(),
            f"Holt-Winters ETS ({ets._seasonal_type}) — 30-day revenue forecast",
        ])
        log.info(f"ETS metrics: {metrics}")
    except Exception as e:
        log.warning(f"ETS training failed: {e}")

    conn.close()
    log.info("=== Time-Series training complete ===")


if __name__ == "__main__":
    main()
