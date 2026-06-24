"""Item2Vec — Self-Supervised Product Embeddings.

學習方式：自監督式學習（Self-Supervised Learning）
技術：Word2Vec Skip-Gram 應用於購買序列
概念：每位客戶的購買歷程 = 一個「句子」，每個商品 = 一個「詞」
訓練後：共同購買的商品在向量空間中距離近
"""
from __future__ import annotations

from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

from utils.logger import get_logger

log = get_logger(__name__)

_MODEL_PATH = Path(__file__).parent.parent.parent.parent / "data" / "models" / "item2vec.model"


class Item2VecModel:
    """Product embedding model via Word2Vec on purchase sequences.

    Each customer's purchase history (sorted by invoice date) is treated as
    a sentence of products, enabling co-purchase proximity in embedding space.
    """

    def __init__(
        self,
        vector_size: int = 64,
        window: int = 5,
        min_count: int = 2,
        epochs: int = 20,
        workers: int = 4,
    ):
        self.vector_size = vector_size
        self.window = window
        self.min_count = min_count
        self.epochs = epochs
        self.workers = workers
        self._model = None  # gensim.models.Word2Vec

    def build_sequences(self, conn: duckdb.DuckDBPyConnection) -> list[list[str]]:
        """Build per-customer purchase sequences ordered by invoice_date."""
        sql = """
        SELECT i.customer_id, ii.stock_code, i.invoice_date
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_no = i.invoice_no
        WHERE i.customer_id IS NOT NULL
        ORDER BY i.customer_id, i.invoice_date
        """
        df = conn.execute(sql).df()
        sequences = (
            df.groupby("customer_id")["stock_code"]
            .apply(list)
            .tolist()
        )
        # Also add per-invoice sequences (items bought together)
        invoice_sql = """
        SELECT invoice_no, stock_code
        FROM invoice_items
        ORDER BY invoice_no
        """
        inv_df = conn.execute(invoice_sql).df()
        invoice_seqs = inv_df.groupby("invoice_no")["stock_code"].apply(list).tolist()
        all_seqs = sequences + invoice_seqs
        log.info(f"Item2Vec: {len(all_seqs)} sequences ({len(sequences)} customer + {len(invoice_seqs)} invoice)")
        return all_seqs

    def fit(self, conn: duckdb.DuckDBPyConnection, **kwargs) -> "Item2VecModel":
        try:
            from gensim.models import Word2Vec
        except ImportError:
            raise ImportError("Install gensim: uv add gensim")

        sequences = self.build_sequences(conn)
        epochs = kwargs.get("epochs", self.epochs)
        self._model = Word2Vec(
            sentences=sequences,
            vector_size=self.vector_size,
            window=self.window,
            min_count=self.min_count,
            sg=1,  # Skip-Gram (better for sparse vocab)
            epochs=epochs,
            workers=self.workers,
            seed=42,
        )
        n_vocab = len(self._model.wv)
        log.info(f"Item2Vec trained: vocab_size={n_vocab}, vector_size={self.vector_size}")
        return self

    def get_embedding(self, stock_code: str) -> np.ndarray | None:
        """Return the embedding vector for a product, or None if OOV."""
        if self._model is None or stock_code not in self._model.wv:
            return None
        return self._model.wv[stock_code]

    def similar_products(self, stock_code: str, n: int = 10) -> list[tuple[str, float]]:
        """Return top-N most similar products by cosine similarity."""
        if self._model is None or stock_code not in self._model.wv:
            return []
        return self._model.wv.most_similar(stock_code, topn=n)

    def get_all_embeddings(self) -> tuple[list[str], np.ndarray]:
        """Return (stock_codes, embeddings) for all products in vocabulary."""
        if self._model is None:
            return [], np.empty((0, self.vector_size))
        codes = list(self._model.wv.key_to_index.keys())
        vecs = np.array([self._model.wv[c] for c in codes])
        return codes, vecs

    def embedding_df(self) -> pd.DataFrame:
        """DataFrame with stock_code and embedding as list (for DuckDB storage)."""
        codes, vecs = self.get_all_embeddings()
        return pd.DataFrame({
            "stock_code": codes,
            "embedding": [v.tolist() for v in vecs],
        })

    def save(self, path: Path | None = None) -> None:
        p = path or _MODEL_PATH
        p.parent.mkdir(parents=True, exist_ok=True)
        self._model.save(str(p))
        log.info(f"Item2Vec model saved to {p}")

    @classmethod
    def load(cls, path: Path | None = None) -> "Item2VecModel":
        try:
            from gensim.models import Word2Vec
        except ImportError:
            raise ImportError("Install gensim: uv add gensim")
        p = path or _MODEL_PATH
        obj = cls()
        obj._model = Word2Vec.load(str(p))
        log.info(f"Item2Vec model loaded from {p}, vocab_size={len(obj._model.wv)}")
        return obj
