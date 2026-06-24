"""NMF Collaborative Filtering via scikit-learn.

學習方式：協同過濾（對照組）
策略：非負矩陣分解（Non-negative Matrix Factorization）
相比 ALS 更易解釋，不需要額外套件。
"""
from __future__ import annotations

import json
import pickle
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from sklearn.decomposition import NMF
from sklearn.preprocessing import normalize

from utils.logger import get_logger

log = get_logger(__name__)

_MODEL_PATH = Path(__file__).parent.parent.parent.parent / "data" / "models" / "nmf_model.pkl"


class NMFRecommender:
    """Collaborative filtering via sklearn NMF.

    Factorizes the customer × product purchase matrix into W (customer factors)
    and H (item factors). Reconstruction W @ H gives implicit purchase scores.
    """

    def __init__(self, n_components: int = 64, max_iter: int = 200, random_state: int = 42):
        self.n_components = n_components
        self.max_iter = max_iter
        self.random_state = random_state
        self._model: NMF | None = None
        self._W: np.ndarray | None = None   # customer factors (n_customers, k)
        self._H: np.ndarray | None = None   # item factors (k, n_items)
        self._customer_ids: list[str] = []
        self._stock_codes: list[str] = []
        self._customer_index: dict[str, int] = {}
        self._item_index: dict[str, int] = {}
        self._purchase_matrix: np.ndarray | None = None

    def _build_matrix(self, conn: duckdb.DuckDBPyConnection) -> np.ndarray:
        sql = """
        SELECT i.customer_id, ii.stock_code, COUNT(*) AS purchase_count
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_no = i.invoice_no
        WHERE i.customer_id IS NOT NULL
        GROUP BY i.customer_id, ii.stock_code
        """
        df = conn.execute(sql).df()
        self._customer_ids = sorted(df["customer_id"].unique().tolist())
        self._stock_codes = sorted(df["stock_code"].unique().tolist())
        self._customer_index = {c: i for i, c in enumerate(self._customer_ids)}
        self._item_index = {s: i for i, s in enumerate(self._stock_codes)}

        n_users = len(self._customer_ids)
        n_items = len(self._stock_codes)
        matrix = np.zeros((n_users, n_items), dtype=np.float32)
        for _, row in df.iterrows():
            u = self._customer_index[row["customer_id"]]
            v = self._item_index[row["stock_code"]]
            matrix[u, v] = np.log1p(row["purchase_count"])
        return matrix

    def fit(self, conn: duckdb.DuckDBPyConnection) -> "NMFRecommender":
        matrix = self._build_matrix(conn)
        self._purchase_matrix = matrix
        self._model = NMF(
            n_components=self.n_components,
            max_iter=self.max_iter,
            random_state=self.random_state,
        )
        self._W = self._model.fit_transform(matrix)
        self._H = self._model.components_
        log.info(f"NMF training complete: components={self.n_components}, reconstruction_err={self._model.reconstruction_err_:.4f}")
        return self

    def recommend(self, customer_id: str, n: int = 10) -> list[dict]:
        """Top-N recommendations from NMF reconstruction scores."""
        if self._model is None:
            raise RuntimeError("Call fit() first.")
        if customer_id not in self._customer_index:
            return []
        user_idx = self._customer_index[customer_id]
        scores = self._W[user_idx] @ self._H  # (n_items,)
        # Zero out already-purchased items
        already_bought = np.where(self._purchase_matrix[user_idx] > 0)[0]
        scores[already_bought] = -1.0
        top_idx = np.argsort(scores)[::-1][:n]
        return [
            {
                "stock_code": self._stock_codes[i],
                "cf_score": float(scores[i]),
                "reason": "collaborative_filtering_nmf",
            }
            for i in top_idx
            if scores[i] > 0
        ]

    def evaluate(self, conn: duckdb.DuckDBPyConnection, k: int = 10) -> dict[str, float]:
        """Precision@K evaluation."""
        sql = """
        SELECT i.customer_id, ii.stock_code, i.invoice_date
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_no = i.invoice_no
        WHERE i.customer_id IS NOT NULL
        ORDER BY i.invoice_date
        """
        df = conn.execute(sql).df()
        cutoff = df["invoice_date"].quantile(0.8)
        test_relevant = (
            df[df["invoice_date"] > cutoff]
            .groupby("customer_id")["stock_code"].apply(set).to_dict()
        )
        p_scores = []
        for customer_id, relevant in test_relevant.items():
            recs = self.recommend(customer_id, n=k)
            hits = sum(1 for r in recs if r["stock_code"] in relevant)
            p_scores.append(hits / k)
        metrics = {f"precision_at_{k}": float(np.mean(p_scores)) if p_scores else 0.0}
        log.info(f"NMF evaluation: {metrics}")
        return metrics

    def save(self, path: Path | None = None) -> None:
        path = path or _MODEL_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(self.__dict__, f)
        log.info(f"NMF model saved to {path}")

    @classmethod
    def load(cls, path: Path | None = None) -> "NMFRecommender":
        path = path or _MODEL_PATH
        with open(path, "rb") as f:
            state = pickle.load(f)
        obj = cls()
        obj.__dict__.update(state)
        log.info(f"NMF model loaded from {path}")
        return obj
