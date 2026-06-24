"""MLP Regression — Customer Lifetime Value Prediction.

學習方式：監督式學習（Supervised Learning）— 回歸（Regression）
輸入：RFM 特徵（6 維）
輸出：預測客戶終身價值（CLV）
"""
from __future__ import annotations

from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from models.deep.base import BaseDeepModel
from utils.logger import get_logger

log = get_logger(__name__)


class _CLVNet:
    """Inner PyTorch network definition (lazy import to avoid torch at module load)."""

    @staticmethod
    def build(input_dim: int = 6):
        import torch.nn as nn
        return nn.Sequential(
            nn.Linear(input_dim, 64), nn.BatchNorm1d(64), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(64, 32),        nn.BatchNorm1d(32), nn.ReLU(), nn.Dropout(0.2),
            nn.Linear(32, 1),
        )


class CLVRegressor(BaseDeepModel):
    """Predict Customer Lifetime Value from RFM features.

    Target: log(1 + monetary) — trained to reduce MSE in log space,
    predictions are exponentiated back to GBP scale.
    """

    def __init__(self, epochs: int = 100, lr: float = 1e-3, batch_size: int = 64):
        super().__init__()
        self.epochs = epochs
        self.lr = lr
        self.batch_size = batch_size
        self.train_loss_history_: list[float] = []

    def _build_net(self) -> None:
        self._net = _CLVNet.build(6)

    def _get_features(self, conn: duckdb.DuckDBPyConnection) -> pd.DataFrame:
        return conn.execute("""
            SELECT recency_days, frequency, monetary,
                   r_score, f_score, m_score
            FROM customer_features
        """).df()

    def fit(self, conn: duckdb.DuckDBPyConnection, **kwargs) -> "CLVRegressor":
        import torch
        import torch.nn as nn
        from torch.utils.data import DataLoader, TensorDataset

        df = self._get_features(conn)
        feature_cols = ["recency_days", "frequency", "monetary", "r_score", "f_score", "m_score"]
        X = df[feature_cols].values.astype(np.float32)
        # Target: log(1 + monetary) — predict in log scale
        y = np.log1p(df["monetary"].values).astype(np.float32).reshape(-1, 1)

        self._scaler = StandardScaler()
        X_scaled = self._scaler.fit_transform(X)

        X_train, X_val, y_train, y_val = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42
        )

        self._build_net()
        optimizer = torch.optim.Adam(self._net.parameters(), lr=self.lr, weight_decay=1e-4)
        criterion = nn.MSELoss()
        epochs = kwargs.get("epochs", self.epochs)

        train_ds = TensorDataset(torch.FloatTensor(X_train), torch.FloatTensor(y_train))
        loader = DataLoader(train_ds, batch_size=self.batch_size, shuffle=True)

        self._net.train()
        for epoch in range(epochs):
            total_loss = 0.0
            for X_batch, y_batch in loader:
                optimizer.zero_grad()
                loss = criterion(self._net(X_batch), y_batch)
                loss.backward()
                optimizer.step()
                total_loss += loss.item()
            self.train_loss_history_.append(total_loss / len(loader))

        # Validate
        self._net.eval()
        with torch.no_grad():
            val_pred = self._net(torch.FloatTensor(X_val)).numpy().flatten()
            val_true = y_val.flatten()
            val_mse = float(np.mean((val_pred - val_true) ** 2))
        log.info(f"CLVRegressor trained: epochs={epochs}, val_MSE(log)={val_mse:.4f}")
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Return predicted CLV in original GBP scale."""
        import torch
        if self._scaler:
            X = self._scaler.transform(X)
        self._net.eval()
        with torch.no_grad():
            log_pred = self._net(torch.FloatTensor(X)).numpy().flatten()
        return np.expm1(log_pred)

    def predict_from_conn(self, conn: duckdb.DuckDBPyConnection) -> pd.DataFrame:
        """Predict CLV for all customers, returns DataFrame(customer_id, predicted_clv)."""
        df = self._get_features(conn)
        feature_cols = ["recency_days", "frequency", "monetary", "r_score", "f_score", "m_score"]
        X = df[feature_cols].values.astype(np.float32)
        preds = self.predict(X)
        return pd.DataFrame({
            "customer_id": conn.execute("SELECT customer_id FROM customer_features").df()["customer_id"],
            "predicted_clv": np.round(preds, 2),
        })

    def evaluate(self, X: np.ndarray, y: np.ndarray) -> dict[str, float]:
        """Compute MAE, RMSE, R² on provided data."""
        preds_log = np.log1p(self.predict(X))
        y_log = np.log1p(y.flatten())
        mae = float(np.mean(np.abs(preds_log - y_log)))
        rmse = float(np.sqrt(np.mean((preds_log - y_log) ** 2)))
        ss_res = np.sum((y_log - preds_log) ** 2)
        ss_tot = np.sum((y_log - y_log.mean()) ** 2)
        r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
        return {"mae": mae, "rmse": rmse, "r2": float(r2)}

    def save(self, path: Path | None = None) -> None:
        super().save(path or self.default_path())

    @classmethod
    def load(cls, path: Path | None = None) -> "CLVRegressor":
        return super().load(path or cls.default_path())
