"""Training script for Deep Learning models.

make train-dl → CLVRegressor + ChurnClassifier + CustomerAutoencoder
→ model_registry table + .pt artifacts
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import numpy as np

from utils.db import get_connection
from utils.logger import get_logger

log = get_logger(__name__)

_FEATURE_SQL = """
    SELECT recency_days, frequency, monetary, r_score, f_score, m_score
    FROM customer_features
"""
_FEAT_COLS = ["recency_days", "frequency", "monetary", "r_score", "f_score", "m_score"]


def main() -> None:
    try:
        import torch  # noqa: F401
    except ImportError:
        log.error("PyTorch not installed. Run: make install-dl")
        raise SystemExit(1)

    conn = get_connection()
    log.info("=== Training Deep Learning Models ===")

    # 共用特徵矩陣（所有 DL 模型使用相同 6 個 RFM 特徵）
    df = conn.execute(_FEATURE_SQL).df()
    X = df[_FEAT_COLS].values.astype(np.float32)
    y_monetary = df["monetary"].values.astype(np.float32)
    y_churn = (df["recency_days"] > 180).values.astype(np.float32)

    # ── CLV Regressor（監督式回歸）────────────────────────────────────────────
    try:
        from models.deep.clv_regressor import CLVRegressor
        log.info("Training CLV Regressor (supervised regression)...")
        clv = CLVRegressor(epochs=100, lr=1e-3)
        clv.fit(conn)
        clv.save()
        # evaluate() 接受 X, y_monetary
        metrics = clv.evaluate(X, y_monetary)
        conn.execute("""
            INSERT OR REPLACE INTO model_registry
                (model_id, model_name, model_type, metrics, artifact_path, trained_at, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            "clv_v1", "clv_regressor", "supervised_regression",
            json.dumps({k: round(float(v), 4) if v is not None else None for k, v in metrics.items()}),
            "data/models/clv_regressor.pt",
            datetime.now(timezone.utc).isoformat(),
            "3-layer MLP regression predicting Customer Lifetime Value in GBP",
        ])
        log.info(f"CLV metrics: {metrics}")
    except Exception as e:
        log.warning(f"CLV training failed: {e}")

    # ── Churn Classifier（監督式分類）─────────────────────────────────────────
    try:
        from models.deep.churn_classifier import ChurnClassifier
        log.info("Training Churn Classifier (supervised classification)...")
        churn = ChurnClassifier(epochs=100, lr=1e-3)
        churn.fit(conn)
        churn.save()
        # evaluate() 接受 X, y_churn
        metrics = churn.evaluate(X, y_churn)
        conn.execute("""
            INSERT OR REPLACE INTO model_registry
                (model_id, model_name, model_type, metrics, artifact_path, trained_at, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            "churn_v1", "churn_classifier", "supervised_classification",
            json.dumps({k: round(float(v), 4) if v is not None else None for k, v in metrics.items()}),
            "data/models/churn_classifier.pt",
            datetime.now(timezone.utc).isoformat(),
            "MLP classifier predicting 180-day churn with BCEWithLogitsLoss + class weight",
        ])
        log.info(f"Churn metrics: {metrics}")
    except Exception as e:
        log.warning(f"Churn training failed: {e}")

    # ── Customer Autoencoder（非監督式異常偵測）───────────────────────────────
    try:
        from models.deep.autoencoder import CustomerAutoencoder
        log.info("Training Customer Autoencoder (unsupervised anomaly detection)...")
        ae = CustomerAutoencoder(epochs=80, lr=1e-3)
        ae.fit(conn)
        ae.save()
        # evaluate() 傳入原始 X；ae.predict() 內部會套用自己的 scaler
        metrics = ae.evaluate(X)
        conn.execute("""
            INSERT OR REPLACE INTO model_registry
                (model_id, model_name, model_type, metrics, artifact_path, trained_at, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            "ae_v1", "customer_autoencoder", "unsupervised_anomaly",
            json.dumps({k: round(float(v), 6) if v is not None else None for k, v in metrics.items()}),
            "data/models/customer_autoencoder.pt",
            datetime.now(timezone.utc).isoformat(),
            "Autoencoder anomaly detection: threshold = mean_error + 2×std",
        ])
        log.info(f"Autoencoder metrics: {metrics}")
    except Exception as e:
        log.warning(f"Autoencoder training failed: {e}")

    conn.close()
    log.info("=== DL training complete ===")


if __name__ == "__main__":
    main()
