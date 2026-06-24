"""Product SBERT Encoder — Transfer Learning.

學習方式：遷移學習（Transfer Learning）
模型：sentence-transformers/all-MiniLM-L6-v2（22MB，CPU 友善）
技術：Zero-shot 推論 — 不 fine-tune，直接用預訓練語意向量
用途：語意搜尋（輸入文字查商品）、商品相似度
"""
from __future__ import annotations

import pickle
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

from utils.logger import get_logger

log = get_logger(__name__)

_EMBEDDINGS_PATH = Path(__file__).parent.parent.parent.parent / "data" / "models" / "product_sbert_embeddings.pkl"
_MODEL_NAME = "all-MiniLM-L6-v2"


class ProductSBERTEncoder:
    """Zero-shot product description encoder using Sentence-BERT.

    Encodes product descriptions into 384-dim L2-normalized vectors.
    Supports semantic search via cosine similarity.
    """

    def __init__(self, model_name: str = _MODEL_NAME):
        self.model_name = model_name
        self._encoder = None   # sentence_transformers.SentenceTransformer
        self._embeddings: np.ndarray | None = None   # (n_products, 384)
        self._stock_codes: list[str] = []
        self._descriptions: list[str] = []

    def _load_encoder(self):
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            raise ImportError("Install: make install-dl (includes sentence-transformers)")
        if self._encoder is None:
            log.info(f"Loading SBERT model: {self.model_name} (first run downloads ~22MB)")
            self._encoder = SentenceTransformer(self.model_name)

    def fit(self, conn: duckdb.DuckDBPyConnection, batch_size: int = 64) -> "ProductSBERTEncoder":
        """Encode all product descriptions into SBERT embeddings."""
        self._load_encoder()
        df = conn.execute("SELECT stock_code, description FROM products WHERE description IS NOT NULL").df()
        df = df.dropna(subset=["description"])
        df["description"] = df["description"].str.strip()
        df = df[df["description"].str.len() > 0]

        self._stock_codes = df["stock_code"].tolist()
        self._descriptions = df["description"].tolist()

        log.info(f"Encoding {len(self._descriptions)} products with SBERT...")
        embeddings = self._encoder.encode(
            self._descriptions,
            batch_size=batch_size,
            show_progress_bar=False,
            normalize_embeddings=True,  # L2 normalize for cosine similarity
        )
        self._embeddings = np.array(embeddings, dtype=np.float32)
        log.info(f"SBERT encoding complete: shape={self._embeddings.shape}")
        return self

    def search(self, query: str, n: int = 10) -> list[dict]:
        """Semantic search: find products most similar to a text query.

        Args:
            query: Free-text query (e.g. "red christmas candle holder").
            n: Number of results.

        Returns:
            List of dicts with stock_code, description, similarity_score.
        """
        self._load_encoder()
        if self._embeddings is None:
            raise RuntimeError("Call fit() first.")
        query_vec = self._encoder.encode([query], normalize_embeddings=True)[0]
        # Cosine similarity (embeddings already L2-normalized → dot product)
        sims = self._embeddings @ query_vec
        top_idx = np.argsort(sims)[::-1][:n]
        return [
            {
                "stock_code": self._stock_codes[i],
                "description": self._descriptions[i],
                "similarity_score": float(sims[i]),
            }
            for i in top_idx
        ]

    def similar_products(self, stock_code: str, n: int = 10) -> list[dict]:
        """Return products with descriptions most semantically similar to the given product."""
        if stock_code not in self._stock_codes:
            return []
        idx = self._stock_codes.index(stock_code)
        return self.search(self._descriptions[idx], n=n + 1)[1:]  # exclude self

    def embedding_df(self) -> pd.DataFrame:
        """DataFrame suitable for DuckDB FLOAT[384] storage."""
        if self._embeddings is None:
            raise RuntimeError("Call fit() first.")
        return pd.DataFrame({
            "stock_code": self._stock_codes,
            "embedding": [e.tolist() for e in self._embeddings],
            "model_name": self.model_name,
        })

    def save(self, path: Path | None = None) -> None:
        p = path or _EMBEDDINGS_PATH
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "wb") as f:
            pickle.dump({
                "model_name": self.model_name,
                "stock_codes": self._stock_codes,
                "descriptions": self._descriptions,
                "embeddings": self._embeddings,
            }, f)
        log.info(f"SBERT embeddings saved to {p}")

    @classmethod
    def load(cls, path: Path | None = None) -> "ProductSBERTEncoder":
        p = path or _EMBEDDINGS_PATH
        with open(p, "rb") as f:
            state = pickle.load(f)
        obj = cls(model_name=state["model_name"])
        obj._stock_codes = state["stock_codes"]
        obj._descriptions = state["descriptions"]
        obj._embeddings = state["embeddings"]
        log.info(f"SBERT embeddings loaded: {len(obj._stock_codes)} products")
        return obj
