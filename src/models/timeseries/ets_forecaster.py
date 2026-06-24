"""Holt-Winters ETS forecasting (SARIMA 對照組).

學習方式：指數平滑時序模型（Exponential Smoothing）
模型：Holt-Winters 加法 / 乘法 — 自動選擇最低 AIC
優點：比 SARIMA 更快、更穩定；適合短至中期預測
"""
from __future__ import annotations

import pickle
import warnings
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

from utils.logger import get_logger

log = get_logger(__name__)

_MODEL_PATH = Path(__file__).parent.parent.parent.parent / "data" / "models" / "ets_model.pkl"


class ETSForecaster:
    """Holt-Winters Exponential Smoothing forecaster.

    Tries both additive and multiplicative seasonal models and keeps
    the one with the lower AIC. Season period defaults to 7 (weekly).
    """

    def __init__(self, seasonal_periods: int = 7):
        self.seasonal_periods = seasonal_periods
        self._model_fit = None
        self._seasonal_type: str = "add"
        self._train_series: pd.Series | None = None
        self.aic_: float | None = None
        self.mape_: float | None = None

    def fit(self, conn: duckdb.DuckDBPyConnection) -> "ETSForecaster":
        try:
            from statsmodels.tsa.holtwinters import ExponentialSmoothing
        except ImportError:
            raise ImportError("Install statsmodels: uv add statsmodels")

        series = self._load_series(conn)
        if len(series) < self.seasonal_periods * 2:
            raise ValueError(f"Need ≥{self.seasonal_periods * 2} data points for ETS.")

        self._train_series = series
        split = int(len(series) * 0.8)
        train, test = series.iloc[:split], series.iloc[split:]

        best_fit, best_aic = None, float("inf")
        for seasonal in ("add", "mul"):
            # Multiplicative requires all-positive series
            if seasonal == "mul" and (train <= 0).any():
                continue
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    m = ExponentialSmoothing(
                        train,
                        trend="add",
                        seasonal=seasonal,
                        seasonal_periods=self.seasonal_periods,
                    ).fit(optimized=True)
                if m.aic < best_aic:
                    best_aic = m.aic
                    best_fit = m
                    self._seasonal_type = seasonal
            except Exception as e:
                log.debug(f"ETS {seasonal} failed: {e}")

        if best_fit is None:
            raise RuntimeError("ETS fitting failed for both additive and multiplicative.")

        self._model_fit = best_fit
        self.aic_ = float(best_aic)

        if len(test) > 0:
            preds = best_fit.forecast(len(test))
            preds = pd.Series(preds.values, index=test.index)
            self.mape_ = float(self._mape(test, preds))

        log.info(f"ETS({self._seasonal_type}) fit: AIC={self.aic_:.2f}, MAPE={self.mape_:.4f}")
        return self

    def forecast(self, steps: int = 30) -> pd.DataFrame:
        if self._model_fit is None:
            raise RuntimeError("Call fit() first.")
        preds = self._model_fit.forecast(steps)
        # ETS doesn't provide CI natively; approximate with ±15% as conservative bound
        lower = np.maximum(preds.values * 0.85, 0)
        upper = preds.values * 1.15
        return pd.DataFrame({
            "date": preds.index,
            "predicted_revenue": np.maximum(preds.values, 0),
            "lower_ci": lower,
            "upper_ci": upper,
            "model_name": "ets",
            "horizon_days": steps,
        })

    @staticmethod
    def _load_series(conn: duckdb.DuckDBPyConnection) -> pd.Series:
        df = conn.execute("SELECT date, revenue FROM daily_sales ORDER BY date").df()
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date").asfreq("D").ffill()
        return df["revenue"].clip(lower=0)

    @staticmethod
    def _mape(actual: pd.Series, predicted: pd.Series) -> float:
        mask = actual > 0
        return float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask]))) if mask.any() else float("nan")

    def save(self, path: Path | None = None) -> None:
        path = path or _MODEL_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(self, f)
        log.info(f"ETS saved to {path}")

    @classmethod
    def load(cls, path: Path | None = None) -> "ETSForecaster":
        path = path or _MODEL_PATH
        with open(path, "rb") as f:
            obj = pickle.load(f)
        return obj
