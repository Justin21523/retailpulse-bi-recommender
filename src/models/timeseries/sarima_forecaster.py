"""SARIMA time-series forecasting.

學習方式：統計序列學習（Statistical Sequential Learning）
模型：SARIMAX(1,1,1)(0,1,1,7) — 含週季節性
流程：ADF 平穩性檢定 → 自動確認差分 → SARIMA 擬合 → 30 天預測
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

_MODEL_PATH = Path(__file__).parent.parent.parent.parent / "data" / "models" / "sarima_model.pkl"

# SARIMA 超參數（已針對零售日資料調好）
_ORDER = (1, 1, 1)
_SEASONAL_ORDER = (0, 1, 1, 7)   # weekly seasonality


class SARIMAForecaster:
    """SARIMA forecaster for daily revenue series.

    Automatically validates stationarity (ADF test) and fits a weekly-seasonal
    SARIMA model. Supports decomposition output for frontend visualization.
    """

    def __init__(
        self,
        order: tuple = _ORDER,
        seasonal_order: tuple = _SEASONAL_ORDER,
    ):
        self.order = order
        self.seasonal_order = seasonal_order
        self._model_fit = None
        self._train_series: pd.Series | None = None
        self.aic_: float | None = None
        self.bic_: float | None = None
        self.mape_: float | None = None   # hold-out MAPE

    # ── Training ──────────────────────────────────────────────────────────────

    def fit(self, conn: duckdb.DuckDBPyConnection) -> "SARIMAForecaster":
        """Fit SARIMA on daily_sales.revenue from DuckDB."""
        try:
            from statsmodels.tsa.statespace.sarimax import SARIMAX
        except ImportError:
            raise ImportError("Install statsmodels: uv add statsmodels")

        series = self._load_series(conn)
        if len(series) < 30:
            raise ValueError(f"Need ≥30 data points for SARIMA, got {len(series)}")

        self._check_stationarity(series)
        self._train_series = series

        # 80% train, 20% hold-out for MAPE estimation
        split = int(len(series) * 0.8)
        train, test = series.iloc[:split], series.iloc[split:]

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = SARIMAX(
                train,
                order=self.order,
                seasonal_order=self.seasonal_order,
                enforce_stationarity=False,
                enforce_invertibility=False,
            )
            self._model_fit = model.fit(disp=0)

        self.aic_ = float(self._model_fit.aic)
        self.bic_ = float(self._model_fit.bic)

        # Evaluate on hold-out
        if len(test) > 0:
            preds = self._model_fit.predict(start=split, end=split + len(test) - 1)
            preds = pd.Series(preds.values, index=test.index)
            self.mape_ = float(self._mape(test, preds))

        log.info(f"SARIMA fit: AIC={self.aic_:.2f}, BIC={self.bic_:.2f}, MAPE={self.mape_:.4f}")
        return self

    # ── Forecasting ───────────────────────────────────────────────────────────

    def forecast(self, steps: int = 30) -> pd.DataFrame:
        """Forecast the next `steps` days.

        Returns:
            DataFrame with columns: date, predicted_revenue, lower_ci, upper_ci.
        """
        if self._model_fit is None:
            raise RuntimeError("Call fit() first.")
        forecast_obj = self._model_fit.get_forecast(steps=steps)
        pred_mean = forecast_obj.predicted_mean
        ci = forecast_obj.conf_int(alpha=0.05)
        return pd.DataFrame({
            "date": pred_mean.index,
            "predicted_revenue": np.maximum(pred_mean.values, 0),
            "lower_ci": np.maximum(ci.iloc[:, 0].values, 0),
            "upper_ci": ci.iloc[:, 1].values,
            "model_name": "sarima",
            "horizon_days": steps,
        })

    def decompose(self) -> dict[str, pd.Series]:
        """Classical time-series decomposition on the training series.

        Returns dict with: trend, seasonal, residual (all pd.Series).
        """
        try:
            from statsmodels.tsa.seasonal import seasonal_decompose
        except ImportError:
            return {}
        if self._train_series is None:
            raise RuntimeError("Call fit() first.")
        result = seasonal_decompose(self._train_series, model="additive", period=7)
        return {
            "trend": result.trend.dropna(),
            "seasonal": result.seasonal.dropna(),
            "residual": result.resid.dropna(),
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _load_series(conn: duckdb.DuckDBPyConnection) -> pd.Series:
        df = conn.execute("SELECT date, revenue FROM daily_sales ORDER BY date").df()
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date").asfreq("D").ffill()
        return df["revenue"].clip(lower=0)

    @staticmethod
    def _check_stationarity(series: pd.Series) -> None:
        """Log ADF test result (does not auto-difference; SARIMA handles that)."""
        try:
            from statsmodels.tsa.stattools import adfuller
            result = adfuller(series.dropna(), autolag="AIC")
            log.info(f"ADF test: stat={result[0]:.4f}, p-value={result[1]:.4f} ({'stationary' if result[1] < 0.05 else 'non-stationary'})")
        except Exception as e:
            log.warning(f"ADF test skipped: {e}")

    @staticmethod
    def _mape(actual: pd.Series, predicted: pd.Series) -> float:
        mask = actual > 0
        if not mask.any():
            return float("nan")
        return float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])))

    # ── Persistence ───────────────────────────────────────────────────────────

    def save(self, path: Path | None = None) -> None:
        path = path or _MODEL_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(self, f)
        log.info(f"SARIMA saved to {path}")

    @classmethod
    def load(cls, path: Path | None = None) -> "SARIMAForecaster":
        path = path or _MODEL_PATH
        with open(path, "rb") as f:
            obj = pickle.load(f)
        log.info(f"SARIMA loaded from {path}")
        return obj
