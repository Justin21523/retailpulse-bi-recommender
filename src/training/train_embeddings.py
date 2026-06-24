"""Training script for Embedding Models.

make train-embeddings → Item2Vec (64-dim) + SBERT (384-dim)
→ item_embeddings table + product_embeddings table
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from utils.db import get_connection
from utils.logger import get_logger

log = get_logger(__name__)


def main() -> None:
    conn = get_connection()
    log.info("=== Training Embedding Models ===")

    # ── Item2Vec — 自監督學習（購買序列 Word2Vec）─────────────────────────────
    try:
        from models.deep.item2vec import Item2VecModel
        log.info("Training Item2Vec (self-supervised)...")
        i2v = Item2VecModel(vector_size=64, window=5, min_count=2, epochs=20)
        i2v.fit(conn)
        i2v.save()

        df = i2v.embedding_df()
        conn.execute("DELETE FROM item_embeddings")
        conn.register("_i2v", df)
        conn.execute("""
            INSERT INTO item_embeddings (stock_code, embedding)
            SELECT stock_code, embedding FROM _i2v
        """)
        log.info(f"Item2Vec: stored {len(df)} product embeddings (dim=64)")

        vocab_size = len(i2v._model.wv)
        conn.execute("""
            INSERT OR REPLACE INTO model_registry
                (model_id, model_name, model_type, metrics, artifact_path, trained_at, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            "item2vec_v1", "item2vec", "self_supervised_embedding",
            json.dumps({"vocab_size": vocab_size, "vector_size": 64}),
            "data/models/item2vec.model",
            datetime.now(timezone.utc).isoformat(),
            "Word2Vec Skip-Gram on customer purchase sequences (co-purchase proximity)",
        ])
    except Exception as e:
        log.warning(f"Item2Vec training failed: {e}")

    # ── SBERT Product Encoder — 遷移學習（all-MiniLM-L6-v2）──────────────────
    try:
        from models.deep.product_encoder import ProductSBERTEncoder
        log.info("Training SBERT Product Encoder (transfer learning)...")
        sbert = ProductSBERTEncoder()
        sbert.fit(conn, batch_size=64)
        sbert.save()

        df = sbert.embedding_df()
        conn.execute("DELETE FROM product_embeddings")
        conn.register("_sbert", df)
        conn.execute("""
            INSERT INTO product_embeddings (stock_code, embedding, model_name)
            SELECT stock_code, embedding, model_name FROM _sbert
        """)
        log.info(f"SBERT: stored {len(df)} product embeddings (dim=384)")

        conn.execute("""
            INSERT OR REPLACE INTO model_registry
                (model_id, model_name, model_type, metrics, artifact_path, trained_at, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            "sbert_v1", "product_sbert_encoder", "transfer_learning_embedding",
            json.dumps({"n_products": len(df), "vector_size": 384, "model": "all-MiniLM-L6-v2"}),
            "data/models/product_sbert_embeddings.pkl",
            datetime.now(timezone.utc).isoformat(),
            "Sentence-BERT zero-shot product description encoder for semantic search",
        ])
    except Exception as e:
        log.warning(f"SBERT training failed: {e}")

    # ── LSTM Forecaster — 序列學習（補充時序模型）────────────────────────────
    try:
        import torch  # noqa: F401
        from models.deep.lstm_forecaster import LSTMForecaster
        log.info("Training LSTM Forecaster (sequential learning)...")
        lstm = LSTMForecaster(seq_len=30, hidden_size=32, num_layers=2, epochs=50)
        lstm.fit(conn)
        lstm.save()

        forecast_df = lstm.forecast(conn, steps=30)
        conn.execute("DELETE FROM sales_forecasts WHERE model_name = 'lstm'")
        conn.register("_lstm_forecast", forecast_df)
        conn.execute("INSERT INTO sales_forecasts (date, predicted_revenue, lower_ci, upper_ci, model_name, horizon_days) SELECT date, predicted_revenue, lower_ci, upper_ci, model_name, horizon_days FROM _lstm_forecast")
        log.info(f"LSTM forecast: {len(forecast_df)} rows stored")

        conn.execute("""
            INSERT OR REPLACE INTO model_registry
                (model_id, model_name, model_type, metrics, artifact_path, trained_at, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [
            "lstm_v1", "lstm_forecaster", "sequential_deep_learning",
            json.dumps({"mape": round(lstm.mape_, 4) if lstm.mape_ else None, "seq_len": 30}),
            "data/models/lstm_forecaster.pt",
            datetime.now(timezone.utc).isoformat(),
            "2-layer LSTM for daily revenue forecasting (window=30 days)",
        ])
    except ImportError:
        log.info("PyTorch not installed, skipping LSTM — run make install-dl first")
    except Exception as e:
        log.warning(f"LSTM training failed: {e}")

    conn.close()
    log.info("=== Embeddings training complete ===")


if __name__ == "__main__":
    main()
