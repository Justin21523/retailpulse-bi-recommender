"""Training script for Collaborative Filtering models.

make train-cf → ALS + NMF → cf_recommendations table + model_registry
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from models.collaborative.als_recommender import ALSRecommender
from models.collaborative.nmf_recommender import NMFRecommender
from utils.db import get_connection
from utils.logger import get_logger

log = get_logger(__name__)


def _register_model(conn, model_id: str, name: str, model_type: str, metrics: dict, path: str) -> None:
    conn.execute("""
        INSERT OR REPLACE INTO model_registry
            (model_id, model_name, model_type, metrics, artifact_path, trained_at, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, [
        model_id, name, model_type,
        json.dumps(metrics), path,
        datetime.now(timezone.utc).isoformat(),
        f"{name} collaborative filtering",
    ])


def main() -> None:
    conn = get_connection()
    log.info("=== Training Collaborative Filtering Models ===")

    # ── ALS ──────────────────────────────────────────────────────────────────
    log.info("Training ALS...")
    als = ALSRecommender(factors=64, regularization=0.01, iterations=50)
    als.fit(conn)
    als.save()

    als_metrics = als.evaluate(conn, k=10)
    log.info(f"ALS metrics: {als_metrics}")
    als.cache_all_recommendations(conn, n=10)
    _register_model(conn, "als_v1", "als_recommender", "collaborative_filtering",
                    als_metrics, "data/models/als_model.pkl")

    # ── NMF ──────────────────────────────────────────────────────────────────
    log.info("Training NMF...")
    nmf = NMFRecommender(n_components=64)
    nmf.fit(conn)
    nmf.save()

    nmf_metrics = nmf.evaluate(conn, k=10)
    log.info(f"NMF metrics: {nmf_metrics}")
    _register_model(conn, "nmf_v1", "nmf_recommender", "collaborative_filtering",
                    nmf_metrics, "data/models/nmf_model.pkl")

    conn.close()
    log.info("=== CF training complete ===")


if __name__ == "__main__":
    main()
