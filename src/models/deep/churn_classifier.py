"""MLP Classification — Customer Churn Prediction.

學習方式：監督式學習（Supervised Learning）— 二元分類（Binary Classification）
輸入：RFM 特徵（6 維）
輸出：流失機率（0-1）
標籤定義：recency_days > 180 → churn=1（超過半年未購買）
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


class ChurnClassifier(BaseDeepModel):
    """Binary churn classifier sharing backbone architecture with CLVRegressor.

    Uses class weights to handle imbalance (At Risk + Lost >> Champions + Loyal).
    """

    CHURN_THRESHOLD_DAYS = 180  # recency_days > this → churned

    def __init__(self, epochs: int = 100, lr: float = 1e-3, batch_size: int = 64):
        super().__init__()
        self.epochs = epochs
        self.lr = lr
        self.batch_size = batch_size
        self.pos_weight_: float = 1.0  # BCEWithLogitsLoss pos_weight

    def _build_net(self) -> None:
        import torch.nn as nn
        self._net = nn.Sequential(
            nn.Linear(6, 64), nn.BatchNorm1d(64), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(64, 32), nn.BatchNorm1d(32), nn.ReLU(), nn.Dropout(0.2),
            nn.Linear(32, 1),  # raw logit — sigmoid applied in loss / predict
        )

    def fit(self, conn: duckdb.DuckDBPyConnection, **kwargs) -> "ChurnClassifier":
        import torch
        import torch.nn as nn
        from torch.utils.data import DataLoader, TensorDataset

        df = conn.execute("""
            SELECT recency_days, frequency, monetary, r_score, f_score, m_score
            FROM customer_features
        """).df()

        feature_cols = ["recency_days", "frequency", "monetary", "r_score", "f_score", "m_score"]
        X = df[feature_cols].values.astype(np.float32)
        y = (df["recency_days"] > self.CHURN_THRESHOLD_DAYS).astype(np.float32).values.reshape(-1, 1)

        self._scaler = StandardScaler()
        X_scaled = self._scaler.fit_transform(X)

        n_pos = y.sum()
        n_neg = len(y) - n_pos
        self.pos_weight_ = float(n_neg / max(n_pos, 1))

        X_train, X_val, y_train, y_val = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42, stratify=(y > 0.5).astype(int)
        )

        self._build_net()
        optimizer = torch.optim.Adam(self._net.parameters(), lr=self.lr, weight_decay=1e-4)
        pos_w = torch.tensor([self.pos_weight_])
        criterion = nn.BCEWithLogitsLoss(pos_weight=pos_w)
        epochs = kwargs.get("epochs", self.epochs)

        train_ds = TensorDataset(torch.FloatTensor(X_train), torch.FloatTensor(y_train))
        loader = DataLoader(train_ds, batch_size=self.batch_size, shuffle=True)

        self._net.train()
        for _ in range(epochs):
            for X_batch, y_batch in loader:
                optimizer.zero_grad()
                loss = criterion(self._net(X_batch), y_batch)
                loss.backward()
                optimizer.step()

        # Validation AUC
        self._net.eval()
        with torch.no_grad():
            logits = self._net(torch.FloatTensor(X_val)).numpy().flatten()
        probs = 1 / (1 + np.exp(-logits))
        auc = self._roc_auc(y_val.flatten(), probs)
        log.info(f"ChurnClassifier trained: epochs={epochs}, val_AUC={auc:.4f}, pos_weight={self.pos_weight_:.1f}")
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Return churn probabilities (0-1)."""
        import torch
        if self._scaler:
            X = self._scaler.transform(X)
        self._net.eval()
        with torch.no_grad():
            logits = self._net(torch.FloatTensor(X)).numpy().flatten()
        return 1 / (1 + np.exp(-logits))

    def predict_from_conn(self, conn: duckdb.DuckDBPyConnection) -> pd.DataFrame:
        """Predict churn probability for all customers."""
        df = conn.execute("""
            SELECT customer_id, recency_days, frequency, monetary,
                   r_score, f_score, m_score
            FROM customer_features
        """).df()
        feature_cols = ["recency_days", "frequency", "monetary", "r_score", "f_score", "m_score"]
        X = df[feature_cols].values.astype(np.float32)
        probs = self.predict(X)
        risk_levels = pd.cut(
            probs,
            bins=[0, 0.3, 0.5, 0.7, 1.0],
            labels=["Low", "Medium", "High", "Critical"],
        )
        return pd.DataFrame({
            "customer_id": df["customer_id"],
            "churn_probability": np.round(probs, 4),
            "risk_level": risk_levels.astype(str),
        }).sort_values("churn_probability", ascending=False)

    def evaluate(self, X: np.ndarray, y: np.ndarray) -> dict[str, float]:
        probs = self.predict(X)
        preds = (probs >= 0.5).astype(int)
        y = y.flatten().astype(int)
        tp = ((preds == 1) & (y == 1)).sum()
        fp = ((preds == 1) & (y == 0)).sum()
        fn = ((preds == 0) & (y == 1)).sum()
        tn = ((preds == 0) & (y == 0)).sum()
        precision = tp / max(tp + fp, 1)
        recall = tp / max(tp + fn, 1)
        f1 = 2 * precision * recall / max(precision + recall, 1e-9)
        auc = self._roc_auc(y, probs)
        return {
            "auc_roc": float(auc), "f1": float(f1),
            "precision": float(precision), "recall": float(recall),
        }

    @staticmethod
    def _roc_auc(y_true: np.ndarray, y_score: np.ndarray) -> float:
        """Simple trapezoid AUC without sklearn dependency."""
        from sklearn.metrics import roc_auc_score
        try:
            return float(roc_auc_score(y_true, y_score))
        except Exception:
            return 0.5

    def save(self, path: Path | None = None) -> None:
        super().save(path or self.default_path())

    @classmethod
    def load(cls, path: Path | None = None) -> "ChurnClassifier":
        return super().load(path or cls.default_path())
