"""TF-IDF + LSA + KMeans product clustering.

學習方式：NLP 文字挖掘（Text Mining）
流程：商品描述 → TF-IDF 向量化 → LSA 降維 → KMeans 分群
用途：發現商品隱式類別，增強 content-based 推薦
"""
from __future__ import annotations

import pickle
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import silhouette_score
from sklearn.pipeline import Pipeline

from utils.logger import get_logger

log = get_logger(__name__)

_MODEL_PATH = Path(__file__).parent.parent.parent.parent / "data" / "models" / "tfidf_product.pkl"


class ProductClustering:
    """TF-IDF → LSA → KMeans pipeline for product description clustering.

    Discovers implicit product categories from text descriptions without
    requiring manual labeling. Each cluster is labeled by its top TF-IDF terms.
    """

    def __init__(
        self,
        n_clusters: int = 20,
        max_features: int = 500,
        n_components: int = 50,
        random_state: int = 42,
    ):
        self.n_clusters = n_clusters
        self.max_features = max_features
        self.n_components = n_components
        self.random_state = random_state

        self._tfidf: TfidfVectorizer | None = None
        self._svd: TruncatedSVD | None = None
        self._kmeans: KMeans | None = None
        self._tfidf_matrix: np.ndarray | None = None   # (n_products, max_features)
        self._lsa_matrix: np.ndarray | None = None    # (n_products, n_components)
        self._stock_codes: list[str] = []
        self._descriptions: list[str] = []
        self._labels: dict[int, str] = {}
        self._keywords: dict[int, str] = {}
        self.silhouette_: float = 0.0

    def fit(self, conn: duckdb.DuckDBPyConnection) -> "ProductClustering":
        """Train TF-IDF + LSA + KMeans on product descriptions."""
        sql = "SELECT stock_code, description FROM products WHERE description IS NOT NULL"
        df = conn.execute(sql).df()
        df = df.dropna(subset=["description"])
        df["description"] = df["description"].str.strip().str.upper()
        df = df[df["description"].str.len() > 0]

        self._stock_codes = df["stock_code"].tolist()
        self._descriptions = df["description"].tolist()
        n_products = len(self._stock_codes)
        log.info(f"Fitting ProductClustering on {n_products} products")

        # Step 1: TF-IDF vectorization
        self._tfidf = TfidfVectorizer(
            max_features=self.max_features,
            ngram_range=(1, 2),
            stop_words="english",
            min_df=2,
        )
        tfidf_matrix = self._tfidf.fit_transform(self._descriptions)
        self._tfidf_matrix = tfidf_matrix

        # Step 2: LSA dimensionality reduction
        n_comp = min(self.n_components, min(tfidf_matrix.shape) - 1)
        self._svd = TruncatedSVD(n_components=n_comp, random_state=self.random_state)
        self._lsa_matrix = self._svd.fit_transform(tfidf_matrix)
        log.info(f"LSA variance explained: {self._svd.explained_variance_ratio_.sum():.3f}")

        # Step 3: KMeans clustering
        n_clusters = min(self.n_clusters, n_products)
        self._kmeans = KMeans(n_clusters=n_clusters, random_state=self.random_state, n_init=10)
        cluster_ids = self._kmeans.fit_predict(self._lsa_matrix)

        # Silhouette score
        if n_products > n_clusters:
            self.silhouette_ = silhouette_score(self._lsa_matrix, cluster_ids, sample_size=min(1000, n_products))
        log.info(f"KMeans({n_clusters}) silhouette: {self.silhouette_:.4f}")

        # Step 4: Generate cluster labels from top TF-IDF terms
        self._labels, self._keywords = self._generate_labels()
        return self

    def _generate_labels(self) -> tuple[dict[int, str], dict[int, str]]:
        """Label each cluster by the 3 highest-TF-IDF terms across its members."""
        if self._tfidf is None or self._kmeans is None:
            return {}, {}
        feature_names = self._tfidf.get_feature_names_out()
        cluster_ids = self._kmeans.labels_
        labels, keywords_map = {}, {}
        n_clusters = self._kmeans.n_clusters
        for cid in range(n_clusters):
            mask = cluster_ids == cid
            if not mask.any():
                labels[cid] = f"Cluster_{cid}"
                keywords_map[cid] = ""
                continue
            # Sum TF-IDF scores for all products in this cluster
            cluster_tfidf = np.asarray(self._tfidf_matrix[mask].sum(axis=0)).flatten()
            top_idx = cluster_tfidf.argsort()[::-1][:3]
            top_words = [feature_names[i] for i in top_idx]
            labels[cid] = " / ".join(top_words[:2]).title()
            keywords_map[cid] = ", ".join(top_words)
        return labels, keywords_map

    def get_cluster_df(self) -> pd.DataFrame:
        """Return DataFrame ready for DuckDB insertion."""
        if self._kmeans is None:
            raise RuntimeError("Call fit() first.")
        cluster_ids = self._kmeans.labels_
        lsa_scores = self._lsa_matrix[:, 0] if self._lsa_matrix is not None else np.zeros(len(self._stock_codes))
        return pd.DataFrame({
            "stock_code": self._stock_codes,
            "cluster_id": cluster_ids.tolist(),
            "cluster_label": [self._labels.get(c, f"Cluster_{c}") for c in cluster_ids],
            "top_keywords": [self._keywords.get(c, "") for c in cluster_ids],
            "lsa_score": lsa_scores.tolist(),
        })

    def get_similar_products(
        self, stock_code: str, n: int = 10
    ) -> list[tuple[str, float]]:
        """Return similar products by cosine similarity in LSA space."""
        if stock_code not in self._stock_codes:
            return []
        idx = self._stock_codes.index(stock_code)
        query_vec = self._lsa_matrix[idx]
        # Cosine similarity
        norms = np.linalg.norm(self._lsa_matrix, axis=1)
        norms[norms == 0] = 1e-9
        sims = (self._lsa_matrix @ query_vec) / (norms * (np.linalg.norm(query_vec) or 1e-9))
        sims[idx] = -1.0  # exclude self
        top_idx = np.argsort(sims)[::-1][:n]
        return [(self._stock_codes[i], float(sims[i])) for i in top_idx]

    def save(self, path: Path | None = None) -> None:
        path = path or _MODEL_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(self.__dict__, f)
        log.info(f"ProductClustering saved to {path}")

    @classmethod
    def load(cls, path: Path | None = None) -> "ProductClustering":
        path = path or _MODEL_PATH
        with open(path, "rb") as f:
            state = pickle.load(f)
        obj = cls()
        obj.__dict__.update(state)
        return obj
