"""Training script for NLP / Text Mining models.

make train-nlp → TF-IDF product clustering → product_clusters_nlp table
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from models.nlp.tfidf_product import ProductClustering
from utils.db import get_connection
from utils.logger import get_logger

log = get_logger(__name__)


def main() -> None:
    conn = get_connection()
    log.info("=== Training NLP Product Clustering ===")

    clustering = ProductClustering(n_clusters=20, max_features=500, n_components=50)
    clustering.fit(conn)
    clustering.save()

    # Persist cluster assignments to DuckDB
    df = clustering.get_cluster_df()
    conn.execute("DELETE FROM product_clusters_nlp")
    conn.register("_clusters", df)
    conn.execute("INSERT INTO product_clusters_nlp SELECT * FROM _clusters")
    log.info(f"Saved {len(df)} product cluster assignments to DuckDB")

    # Register model
    metrics = {"silhouette_score": round(clustering.silhouette_, 4), "n_clusters": 20}
    conn.execute("""
        INSERT OR REPLACE INTO model_registry
            (model_id, model_name, model_type, metrics, artifact_path, trained_at, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, [
        "tfidf_v1", "tfidf_product_clustering", "nlp_unsupervised",
        json.dumps(metrics), "data/models/tfidf_product.pkl",
        datetime.now(timezone.utc).isoformat(),
        "TF-IDF + LSA + KMeans product description clustering",
    ])

    conn.close()
    log.info("=== NLP training complete ===")


if __name__ == "__main__":
    main()
