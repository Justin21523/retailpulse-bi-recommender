"""Semantic search over products using SBERT embeddings stored in DuckDB.

從 product_embeddings 表讀取預計算向量，執行 cosine 相似度查詢。
不需要在每次請求時重新載入 SBERT 模型 — 只用 numpy 運算。
"""
from __future__ import annotations

import numpy as np
import duckdb
import pandas as pd

from utils.logger import get_logger

log = get_logger(__name__)


class SemanticSearchEngine:
    """Vector similarity search over pre-computed SBERT product embeddings.

    Loads embeddings once from DuckDB into RAM for fast query-time dot products.
    No model inference at query time — query vector is computed by the encoder.
    """

    def __init__(self) -> None:
        self._stock_codes: list[str] = []
        self._descriptions: list[str] = []
        self._embeddings: np.ndarray | None = None  # shape (n, 384)

    def load(self, conn: duckdb.DuckDBPyConnection) -> "SemanticSearchEngine":
        """Load pre-computed embeddings from product_embeddings table."""
        df = conn.execute("""
            SELECT pe.stock_code, p.description, pe.embedding
            FROM product_embeddings pe
            LEFT JOIN products p ON pe.stock_code = p.stock_code
            ORDER BY pe.stock_code
        """).df()

        if df.empty:
            log.warning("product_embeddings table is empty — run make train-embeddings first.")
            return self

        self._stock_codes = df["stock_code"].tolist()
        self._descriptions = df["description"].fillna("").tolist()
        # DuckDB returns FLOAT[] as a list; convert to ndarray
        self._embeddings = np.array(df["embedding"].tolist(), dtype=np.float32)
        log.info(f"SemanticSearchEngine loaded: {len(self._stock_codes)} products, dim={self._embeddings.shape[1]}")
        return self

    def search_by_vector(self, query_vec: np.ndarray, n: int = 10) -> list[dict]:
        """Return top-N products by cosine similarity to query_vec."""
        if self._embeddings is None or len(self._stock_codes) == 0:
            return []
        q = query_vec / (np.linalg.norm(query_vec) + 1e-8)
        sims = self._embeddings @ q
        top_idx = np.argsort(sims)[::-1][:n]
        return [
            {
                "stock_code": self._stock_codes[i],
                "description": self._descriptions[i],
                "similarity_score": float(sims[i]),
            }
            for i in top_idx
        ]

    def search_by_text(
        self,
        query: str,
        n: int = 10,
        encoder=None,
    ) -> list[dict]:
        """Encode query text on the fly and search.

        Args:
            query: Free-text query.
            n: Number of results.
            encoder: ProductSBERTEncoder instance (optional; loads lazily if None).
        """
        if encoder is None:
            from models.deep.product_encoder import ProductSBERTEncoder
            encoder = ProductSBERTEncoder()
            encoder._load_encoder()

        query_vec = encoder._encoder.encode([query], normalize_embeddings=True)[0]
        return self.search_by_vector(query_vec, n=n)

    def similar(self, stock_code: str, n: int = 10) -> list[dict]:
        """Find products similar to a given stock_code."""
        if stock_code not in self._stock_codes:
            return []
        idx = self._stock_codes.index(stock_code)
        results = self.search_by_vector(self._embeddings[idx], n=n + 1)
        return [r for r in results if r["stock_code"] != stock_code][:n]

    def cluster_embeddings_summary(self, conn: duckdb.DuckDBPyConnection) -> pd.DataFrame:
        """Join NLP cluster labels with SBERT embedding counts per cluster."""
        return conn.execute("""
            SELECT cluster_id, cluster_label,
                   COUNT(*) as product_count,
                   AVG(lsa_score) as avg_lsa_score
            FROM product_clusters_nlp
            GROUP BY cluster_id, cluster_label
            ORDER BY product_count DESC
        """).df()
