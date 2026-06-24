"""RFM customer segmentation via K-Means clustering."""
from __future__ import annotations

import pickle
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from utils.logger import get_logger

log = get_logger(__name__)

_MODEL_PATH = Path(__file__).parent.parent.parent / "data" / "models" / "rfm_kmeans.pkl"

_SEGMENT_LABELS = ["Champions", "Loyal Customers", "At Risk", "Lost"]


def _label_clusters(df: pd.DataFrame, centers: np.ndarray) -> dict[int, str]:
    """Map cluster indices to human-readable segment names by centroid ranking.

    Strategy:
    - Champions: high F+M, low recency (best customers)
    - Loyal Customers: high F, moderate M
    - At Risk: moderate recency, decreasing activity
    - Lost: high recency (long ago), low F+M
    """
    center_df = pd.DataFrame(centers, columns=["recency_scaled", "frequency_scaled", "monetary_scaled"])
    # Score = F + M - R (higher is better)
    center_df["score"] = (
        center_df["frequency_scaled"] + center_df["monetary_scaled"] - center_df["recency_scaled"]
    )
    ranking = center_df["score"].rank(ascending=False).astype(int)
    label_map = {idx: _SEGMENT_LABELS[rank - 1] for idx, rank in ranking.items()}
    return label_map


def segment_customers(rfm_df: pd.DataFrame, n_clusters: int = 4) -> pd.DataFrame:
    """Apply K-Means clustering to RFM-scored customers.

    Args:
        rfm_df: DataFrame from :func:`features.rfm.score_rfm`, with columns
                recency_days, frequency, monetary.
        n_clusters: Number of customer segments.

    Returns:
        Input DataFrame augmented with ``cluster`` (int) and ``segment`` (str) columns.
    """
    df = rfm_df.copy()
    features = df[["recency_days", "frequency", "monetary"]].values

    scaler = StandardScaler()
    scaled = scaler.fit_transform(features)

    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    df["cluster"] = kmeans.fit_predict(scaled)

    label_map = _label_clusters(df, kmeans.cluster_centers_)
    df["segment"] = df["cluster"].map(label_map)

    # Persist model
    _MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_MODEL_PATH, "wb") as f:
        pickle.dump({"scaler": scaler, "kmeans": kmeans, "label_map": label_map}, f)

    seg_counts = df["segment"].value_counts().to_dict()
    log.info(f"RFM segmentation complete: {seg_counts}")
    return df


def save_customer_features(conn: duckdb.DuckDBPyConnection, segmented_df: pd.DataFrame) -> None:
    """Persist customer features (RFM + segment) to the warehouse.

    Args:
        conn: Open DuckDB connection.
        segmented_df: DataFrame from :func:`segment_customers`.
    """
    cf = segmented_df[
        ["customer_id", "recency_days", "frequency", "monetary",
         "r_score", "f_score", "m_score", "rfm_score", "segment"]
    ].copy()

    conn.execute("DELETE FROM customer_features")
    conn.register("_cf", cf)
    conn.execute("INSERT INTO customer_features SELECT * FROM _cf")
    log.info(f"customer_features table: {len(cf)} rows saved")
