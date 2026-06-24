"""Sales Forecast API routes.

GET /forecast/revenue?model=sarima|ets|lstm&horizon=30
GET /forecast/decomposition?model=sarima
GET /forecast/models
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from utils.db import get_connection
from utils.logger import get_logger

router = APIRouter()
log = get_logger(__name__)


class ForecastPoint(BaseModel):
    date: str
    predicted_revenue: float
    lower_ci: float
    upper_ci: float
    model_name: str


class ForecastResponse(BaseModel):
    forecasts: list[ForecastPoint]
    model_name: str
    horizon_days: int
    mape: float | None = None


class DecompositionResponse(BaseModel):
    dates: list[str]
    observed: list[float]
    trend: list[float]
    seasonal: list[float]
    residual: list[float]


def _get_conn():
    return get_connection()


def _load_from_db(model_name: str, horizon: int) -> list[dict]:
    """Read pre-computed forecasts from DuckDB."""
    conn = _get_conn()
    try:
        df = conn.execute("""
            SELECT date, predicted_revenue, lower_ci, upper_ci, model_name
            FROM sales_forecasts
            WHERE model_name = ?
            ORDER BY date
            LIMIT ?
        """, [model_name, horizon]).df()
        return df.to_dict("records")
    finally:
        conn.close()


@router.get("/forecast/revenue", response_model=ForecastResponse)
def get_revenue_forecast(
    model: str = Query("sarima", pattern="^(sarima|ets|lstm)$"),
    horizon: int = Query(30, ge=7, le=90),
):
    """Return pre-computed revenue forecast from DuckDB.

    Falls back to live inference if DuckDB has no rows for the model.
    """
    rows = _load_from_db(model, horizon)

    if not rows:
        # Attempt live computation (slow path — only during demo without pre-training)
        try:
            conn = _get_conn()
            try:
                if model == "sarima":
                    from models.timeseries.sarima_forecaster import SARIMAForecaster
                    fc = SARIMAForecaster.load()
                    df = fc.forecast(steps=horizon)
                elif model == "ets":
                    from models.timeseries.ets_forecaster import ETSForecaster
                    fc = ETSForecaster.load()
                    df = fc.forecast(steps=horizon)
                else:
                    from models.deep.lstm_forecaster import LSTMForecaster
                    fc = LSTMForecaster.load()
                    df = fc.forecast(conn, steps=horizon)
                rows = df.head(horizon).to_dict("records")
            finally:
                conn.close()
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Forecast unavailable: {e}")

    forecasts = [
        ForecastPoint(
            date=str(r["date"]),
            predicted_revenue=round(float(r["predicted_revenue"]), 2),
            lower_ci=round(float(r["lower_ci"]), 2),
            upper_ci=round(float(r["upper_ci"]), 2),
            model_name=model,
        )
        for r in rows[:horizon]
    ]

    # Fetch MAPE from model_registry
    conn = _get_conn()
    try:
        reg = conn.execute(
            "SELECT metrics FROM model_registry WHERE model_name = ?",
            [f"{model}_forecaster"],
        ).fetchone()
    finally:
        conn.close()
    mape = None
    if reg:
        import json
        metrics = json.loads(reg[0] or "{}")
        mape = metrics.get("mape")

    return ForecastResponse(
        forecasts=forecasts,
        model_name=model,
        horizon_days=horizon,
        mape=mape,
    )


@router.get("/forecast/decomposition", response_model=DecompositionResponse)
def get_decomposition():
    """Return SARIMA seasonal decomposition (trend / seasonal / residual)."""
    try:
        from models.timeseries.sarima_forecaster import SARIMAForecaster
        sarima = SARIMAForecaster.load()
        result = sarima.decompose()   # no conn arg — uses _train_series from pickle
        # _train_series is the original daily revenue used for training
        observed = sarima._train_series
        # Align indices across all series (intersect)
        idx = result["trend"].index.intersection(result["seasonal"].index).intersection(result["residual"].index)
        if observed is not None:
            idx = idx.intersection(observed.index)
        return DecompositionResponse(
            dates=[str(d.date()) for d in idx],
            observed=[float(observed[d]) for d in idx] if observed is not None else [],
            trend=[float(result["trend"][d]) for d in idx],
            seasonal=[float(result["seasonal"][d]) for d in idx],
            residual=[float(result["residual"][d]) for d in idx],
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Decomposition unavailable: {e}")


@router.get("/forecast/models")
def list_forecast_models():
    """Return all forecast model metadata from model_registry."""
    conn = _get_conn()
    import json
    try:
        rows = conn.execute("""
            SELECT model_id, model_name, model_type, metrics, trained_at, description
            FROM model_registry WHERE model_type = 'time_series'
            OR model_name LIKE '%forecaster%'
            ORDER BY trained_at DESC
        """).fetchall()
    finally:
        conn.close()
    return [
        {
            "model_id": r[0],
            "model_name": r[1],
            "model_type": r[2],
            "metrics": json.loads(r[3] or "{}"),
            "trained_at": r[4],
            "description": r[5],
        }
        for r in rows
    ]
