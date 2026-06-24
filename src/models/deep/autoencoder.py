"""Customer Autoencoder — Anomaly Detection.

學習方式：非監督式學習（Unsupervised Learning）
架構：Autoencoder（編碼器 + 解碼器）
原理：在正常資料上訓練重建，異常客戶因行為偏離而產生高重建誤差
輸出：每位客戶的 anomaly_score（重建 MSE），高分 = 異常
"""
from __future__ import annotations

from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from models.deep.base import BaseDeepModel
from utils.logger import get_logger

log = get_logger(__name__)


class CustomerAutoencoder(BaseDeepModel):
    """Autoencoder for detecting anomalous customer purchasing behavior.

    Training: minimize reconstruction error on all customers.
    Detection: customers with error > mean + 2×std are flagged as anomalies.
    """

    def __init__(self, epochs: int = 100, lr: float = 1e-3, batch_size: int = 64):
        super().__init__()
        self.epochs = epochs
        self.lr = lr
        self.batch_size = batch_size
        self._threshold: float | None = None  # mean + 2*std on training data

    def _build_net(self) -> None:
        import torch.nn as nn

        class AENet(nn.Module):
            def __init__(self):
                super().__init__()
                self.encoder = nn.Sequential(
                    nn.Linear(6, 32), nn.ReLU(),
                    nn.Linear(32, 16), nn.ReLU(),
                    nn.Linear(16, 8),
                )
                self.decoder = nn.Sequential(
                    nn.Linear(8, 16), nn.ReLU(),
                    nn.Linear(16, 32), nn.ReLU(),
                    nn.Linear(32, 6),
                )

            def forward(self, x):
                return self.decoder(self.encoder(x))

            def encode(self, x):
                return self.encoder(x)

        self._net = AENet()

    def fit(self, conn: duckdb.DuckDBPyConnection, **kwargs) -> "CustomerAutoencoder":
        import torch
        import torch.nn as nn
        from torch.utils.data import DataLoader, TensorDataset

        df = conn.execute("""
            SELECT recency_days, frequency, monetary, r_score, f_score, m_score
            FROM customer_features
        """).df()
        feature_cols = ["recency_days", "frequency", "monetary", "r_score", "f_score", "m_score"]
        X = df[feature_cols].values.astype(np.float32)
        self._scaler = StandardScaler()
        X_scaled = self._scaler.fit_transform(X)

        self._build_net()
        optimizer = torch.optim.Adam(self._net.parameters(), lr=self.lr, weight_decay=1e-5)
        criterion = nn.MSELoss()
        epochs = kwargs.get("epochs", self.epochs)

        ds = TensorDataset(torch.FloatTensor(X_scaled))
        loader = DataLoader(ds, batch_size=self.batch_size, shuffle=True)

        self._net.train()
        for _ in range(epochs):
            for (X_batch,) in loader:
                optimizer.zero_grad()
                recon = self._net(X_batch)
                loss = criterion(recon, X_batch)
                loss.backward()
                optimizer.step()

        # Compute anomaly threshold on full training data
        train_errors = self._reconstruction_errors(X_scaled)
        self._threshold = float(np.mean(train_errors) + 2 * np.std(train_errors))
        anomaly_rate = float((train_errors > self._threshold).mean())
        log.info(f"Autoencoder trained: threshold={self._threshold:.6f}, anomaly_rate={anomaly_rate:.3f}")
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Return reconstruction errors (anomaly scores) for each sample."""
        return self._reconstruction_errors(self._scaler.transform(X) if self._scaler else X)

    def _reconstruction_errors(self, X_scaled: np.ndarray) -> np.ndarray:
        import torch
        self._net.eval()
        with torch.no_grad():
            X_t = torch.FloatTensor(X_scaled)
            recon = self._net(X_t).numpy()
        return np.mean((X_scaled - recon) ** 2, axis=1)

    def predict_from_conn(self, conn: duckdb.DuckDBPyConnection, top_k: int = 50) -> pd.DataFrame:
        """Return top_k anomalous customers sorted by anomaly score."""
        df = conn.execute("""
            SELECT customer_id, recency_days, frequency, monetary,
                   r_score, f_score, m_score
            FROM customer_features
        """).df()
        feature_cols = ["recency_days", "frequency", "monetary", "r_score", "f_score", "m_score"]
        X = df[feature_cols].values.astype(np.float32)
        errors = self.predict(X)
        is_anomaly = errors > (self._threshold or float("inf"))
        result = pd.DataFrame({
            "customer_id": df["customer_id"],
            "anomaly_score": np.round(errors, 6),
            "is_anomaly": is_anomaly,
        }).sort_values("anomaly_score", ascending=False)
        return result.head(top_k)

    def evaluate(self, X: np.ndarray, y: np.ndarray | None = None) -> dict[str, float]:
        """Evaluate by reconstruction MSE statistics."""
        errors = self.predict(X)
        return {
            "mean_reconstruction_error": float(np.mean(errors)),
            "std_reconstruction_error": float(np.std(errors)),
            "anomaly_rate": float((errors > (self._threshold or float("inf"))).mean()),
            "threshold": float(self._threshold or 0),
        }

    def save(self, path: Path | None = None) -> None:
        import pickle as _pkl
        p = path or self.default_path()
        super().save(p)
        # Also persist threshold
        with open(p.with_suffix(".threshold.pkl"), "wb") as f:
            _pkl.dump(self._threshold, f)

    @classmethod
    def load(cls, path: Path | None = None) -> "CustomerAutoencoder":
        import pickle as _pkl
        p = path or cls.default_path()
        obj = super().load(p)
        thresh_path = p.with_suffix(".threshold.pkl")
        if thresh_path.exists():
            with open(thresh_path, "rb") as f:
                obj._threshold = _pkl.load(f)
        return obj
