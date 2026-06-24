"""LSTM Time-Series Forecaster.

學習方式：序列學習（Sequential / Recurrent Learning）
架構：LSTM(input=1, hidden=32, layers=2) → Linear(1)
輸入：sliding window of daily revenue (seq_len=30)
輸出：next-day revenue prediction
"""
from __future__ import annotations

import pickle
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

from utils.logger import get_logger

log = get_logger(__name__)

_MODEL_PATH = Path(__file__).parent.parent.parent.parent / "data" / "models" / "lstm_forecaster.pt"


class LSTMForecaster:
    """LSTM-based daily revenue forecaster.

    Transforms the revenue series via MinMaxScaler, builds sliding-window
    sequences, and trains a 2-layer LSTM to predict the next day's value.
    """

    def __init__(
        self,
        seq_len: int = 30,
        hidden_size: int = 32,
        num_layers: int = 2,
        epochs: int = 50,
        lr: float = 1e-3,
        batch_size: int = 32,
    ):
        self.seq_len = seq_len
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.epochs = epochs
        self.lr = lr
        self.batch_size = batch_size
        self._net = None
        self._scaler: MinMaxScaler | None = None
        self.mape_: float | None = None

    def _build_net(self) -> None:
        import torch.nn as nn

        class LSTMNet(nn.Module):
            def __init__(self, hidden, layers):
                super().__init__()
                self.lstm = nn.LSTM(
                    input_size=1, hidden_size=hidden,
                    num_layers=layers, dropout=0.2,
                    batch_first=True,
                )
                self.fc = nn.Linear(hidden, 1)

            def forward(self, x):
                out, _ = self.lstm(x)
                return self.fc(out[:, -1, :])

        self._net = LSTMNet(self.hidden_size, self.num_layers)

    @staticmethod
    def _load_series(conn: duckdb.DuckDBPyConnection) -> np.ndarray:
        df = conn.execute("SELECT date, revenue FROM daily_sales ORDER BY date").df()
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date").asfreq("D").ffill()
        return df["revenue"].clip(lower=0).values.astype(np.float32)

    @staticmethod
    def _make_sequences(series: np.ndarray, seq_len: int):
        X, y = [], []
        for i in range(len(series) - seq_len):
            X.append(series[i:i + seq_len])
            y.append(series[i + seq_len])
        return np.array(X), np.array(y)

    def fit(self, conn: duckdb.DuckDBPyConnection, **kwargs) -> "LSTMForecaster":
        import torch
        import torch.nn as nn
        from torch.utils.data import DataLoader, TensorDataset

        raw = self._load_series(conn)
        if len(raw) < self.seq_len + 10:
            raise ValueError(f"Need ≥{self.seq_len + 10} data points for LSTM.")

        self._scaler = MinMaxScaler()
        scaled = self._scaler.fit_transform(raw.reshape(-1, 1)).flatten()

        X_all, y_all = self._make_sequences(scaled, self.seq_len)
        split = int(len(X_all) * 0.8)
        X_train, y_train = X_all[:split], y_all[:split]
        X_val,   y_val   = X_all[split:], y_all[split:]

        self._build_net()
        optimizer = torch.optim.Adam(self._net.parameters(), lr=self.lr)
        criterion = nn.MSELoss()
        epochs = kwargs.get("epochs", self.epochs)

        X_t = torch.FloatTensor(X_train).unsqueeze(-1)
        y_t = torch.FloatTensor(y_train).unsqueeze(-1)
        ds = TensorDataset(X_t, y_t)
        loader = DataLoader(ds, batch_size=self.batch_size, shuffle=True)

        self._net.train()
        for _ in range(epochs):
            for X_batch, y_batch in loader:
                optimizer.zero_grad()
                loss = criterion(self._net(X_batch), y_batch)
                loss.backward()
                optimizer.step()

        # MAPE on validation set (original scale)
        self._net.eval()
        with torch.no_grad():
            val_pred_scaled = self._net(torch.FloatTensor(X_val).unsqueeze(-1)).numpy().flatten()
        val_pred = self._scaler.inverse_transform(val_pred_scaled.reshape(-1, 1)).flatten()
        val_true = self._scaler.inverse_transform(y_val.reshape(-1, 1)).flatten()
        mask = val_true > 0
        self.mape_ = float(np.mean(np.abs((val_true[mask] - val_pred[mask]) / val_true[mask]))) if mask.any() else None
        log.info(f"LSTM trained: epochs={epochs}, val_MAPE={self.mape_:.4f}")
        return self

    def forecast(self, conn: duckdb.DuckDBPyConnection, steps: int = 30) -> pd.DataFrame:
        """Forecast next `steps` days using rolling single-step prediction."""
        import torch
        raw = self._load_series(conn)
        scaled = self._scaler.transform(raw.reshape(-1, 1)).flatten()
        window = scaled[-self.seq_len:].copy()
        last_date = pd.to_datetime(
            conn.execute("SELECT MAX(date) FROM daily_sales").fetchone()[0]
        )

        preds_scaled, dates = [], []
        self._net.eval()
        for i in range(steps):
            x = torch.FloatTensor(window).unsqueeze(0).unsqueeze(-1)
            with torch.no_grad():
                pred = float(self._net(x).item())
            preds_scaled.append(pred)
            window = np.roll(window, -1)
            window[-1] = pred
            dates.append(last_date + pd.Timedelta(days=i + 1))

        preds = self._scaler.inverse_transform(np.array(preds_scaled).reshape(-1, 1)).flatten()
        preds = np.maximum(preds, 0)
        std_est = float(np.std(preds) * 0.3)
        return pd.DataFrame({
            "date": dates,
            "predicted_revenue": preds,
            "lower_ci": np.maximum(preds - 1.96 * std_est, 0),
            "upper_ci": preds + 1.96 * std_est,
            "model_name": "lstm",
            "horizon_days": steps,
        })

    def save(self, path: Path | None = None) -> None:
        import torch
        p = path or _MODEL_PATH
        p.parent.mkdir(parents=True, exist_ok=True)
        torch.save(self._net.state_dict(), p)
        with open(p.with_suffix(".scaler.pkl"), "wb") as f:
            pickle.dump(self._scaler, f)
        log.info(f"LSTMForecaster saved to {p}")

    @classmethod
    def load(cls, path: Path | None = None) -> "LSTMForecaster":
        import torch
        p = path or _MODEL_PATH
        obj = cls()
        obj._build_net()
        obj._net.load_state_dict(torch.load(p, map_location="cpu"))
        obj._net.eval()
        with open(p.with_suffix(".scaler.pkl"), "rb") as f:
            obj._scaler = pickle.load(f)
        return obj
