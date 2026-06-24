"""ALS Collaborative Filtering via implicit library.

學習方式：協同過濾（Collaborative Filtering）
策略：隱式反饋（Implicit Feedback）— 購買次數作為置信度
"""
from __future__ import annotations

import json
import pickle
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
import scipy.sparse as sp

from utils.logger import get_logger

log = get_logger(__name__)

_MODEL_PATH = Path(__file__).parent.parent.parent.parent / "data" / "models" / "als_model.pkl"


class ALSRecommender:
    """Alternating Least Squares collaborative filtering.

    Builds a customer × product implicit feedback matrix from purchase history,
    then factorizes it into latent user and item factors.
    """

    def __init__(self, factors: int = 64, regularization: float = 0.01, iterations: int = 50):
        self.factors = factors
        self.regularization = regularization
        self.iterations = iterations
        self._model = None
        self._customer_ids: list[str] = []
        self._stock_codes: list[str] = []
        self._customer_index: dict[str, int] = {}
        self._item_index: dict[str, int] = {}
        self._user_items: sp.csr_matrix | None = None

    def build_matrix(self, conn: duckdb.DuckDBPyConnection) -> sp.csr_matrix:
        """Build customer × product implicit feedback matrix.

        Value: log(1 + purchase_count) per (customer, product) pair.
        """
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

        rows = df["customer_id"].map(self._customer_index).values
        cols = df["stock_code"].map(self._item_index).values
        # Implicit confidence: log(1 + count)
        data = np.log1p(df["purchase_count"].values).astype(np.float32)

        n_users = len(self._customer_ids)
        n_items = len(self._stock_codes)
        matrix = sp.csr_matrix((data, (rows, cols)), shape=(n_users, n_items))
        log.info(f"ALS matrix: {n_users} customers × {n_items} products, density={matrix.nnz / (n_users * n_items):.4f}")
        return matrix

    def fit(self, conn: duckdb.DuckDBPyConnection) -> "ALSRecommender":
        """Train ALS model on purchase history from DuckDB."""
        try:
            from implicit.als import AlternatingLeastSquares
        except ImportError:
            raise ImportError("Install implicit: uv add implicit")

        matrix = self.build_matrix(conn)
        self._user_items = matrix

        self._model = AlternatingLeastSquares(
            factors=self.factors,
            regularization=self.regularization,
            iterations=self.iterations,
        )
        self._model.fit(matrix)
        log.info(f"ALS training complete: factors={self.factors}, iterations={self.iterations}")
        return self

    def recommend(
        self,
        customer_id: str,
        n: int = 10,
        filter_already_bought: bool = True,
    ) -> list[dict]:
        """Return top-N product recommendations for a customer.

        Args:
            customer_id: Target customer.
            n: Number of recommendations.
            filter_already_bought: Exclude previously purchased products.

        Returns:
            List of dicts with stock_code and cf_score.
        """
        if self._model is None:
            raise RuntimeError("Model not trained. Call fit() first.")
        if customer_id not in self._customer_index:
            return []

        user_idx = self._customer_index[customer_id]
        user_items = self._user_items[user_idx]

        item_ids, scores = self._model.recommend(
            user_idx,
            user_items,
            N=n,
            filter_already_liked_items=filter_already_bought,
        )
        results = []
        for item_idx, score in zip(item_ids, scores):
            results.append({
                "stock_code": self._stock_codes[item_idx],
                "cf_score": float(score),
                "reason": "collaborative_filtering_als",
            })
        return results

    def evaluate(self, conn: duckdb.DuckDBPyConnection, k: int = 10) -> dict[str, float]:
        """Temporal hold-out evaluation: NDCG@K and MAP@K.

        Splits invoice_items by invoice_date (80% train / 20% test).
        """
        sql = """
        SELECT i.customer_id, ii.stock_code, i.invoice_date
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_no = i.invoice_no
        WHERE i.customer_id IS NOT NULL
        ORDER BY i.invoice_date
        """
        df = conn.execute(sql).df()
        cutoff = df["invoice_date"].quantile(0.8)
        test_df = df[df["invoice_date"] > cutoff]
        test_relevant = (
            test_df.groupby("customer_id")["stock_code"].apply(set).to_dict()
        )

        ndcg_scores, ap_scores = [], []
        for customer_id, relevant in test_relevant.items():
            recs = self.recommend(customer_id, n=k)
            if not recs:
                continue
            rec_codes = [r["stock_code"] for r in recs]
            # NDCG@K
            dcg = sum(
                1.0 / np.log2(i + 2)
                for i, code in enumerate(rec_codes)
                if code in relevant
            )
            ideal_hits = min(len(relevant), k)
            idcg = sum(1.0 / np.log2(i + 2) for i in range(ideal_hits))
            ndcg_scores.append(dcg / idcg if idcg > 0 else 0.0)
            # AP@K
            hits, precision_sum = 0, 0.0
            for i, code in enumerate(rec_codes):
                if code in relevant:
                    hits += 1
                    precision_sum += hits / (i + 1)
            ap = precision_sum / min(len(relevant), k) if relevant else 0.0
            ap_scores.append(ap)

        metrics = {
            f"ndcg_at_{k}": float(np.mean(ndcg_scores)) if ndcg_scores else 0.0,
            f"map_at_{k}": float(np.mean(ap_scores)) if ap_scores else 0.0,
            "n_evaluated": len(ndcg_scores),
        }
        log.info(f"ALS evaluation: {metrics}")
        return metrics

    def save(self, path: Path | None = None) -> None:
        path = path or _MODEL_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({
                "model": self._model,
                "customer_ids": self._customer_ids,
                "stock_codes": self._stock_codes,
                "customer_index": self._customer_index,
                "item_index": self._item_index,
                "user_items": self._user_items,
            }, f)
        log.info(f"ALS model saved to {path}")

    @classmethod
    def load(cls, path: Path | None = None) -> "ALSRecommender":
        path = path or _MODEL_PATH
        with open(path, "rb") as f:
            state = pickle.load(f)
        obj = cls()
        obj._model = state["model"]
        obj._customer_ids = state["customer_ids"]
        obj._stock_codes = state["stock_codes"]
        obj._customer_index = state["customer_index"]
        obj._item_index = state["item_index"]
        obj._user_items = state["user_items"]
        log.info(f"ALS model loaded from {path}")
        return obj

    def cache_all_recommendations(
        self, conn: duckdb.DuckDBPyConnection, n: int = 10
    ) -> None:
        """Pre-compute and store recommendations for all customers in DuckDB."""
        conn.execute("DELETE FROM cf_recommendations")
        rows = []
        for customer_id in self._customer_ids:
            recs = self.recommend(customer_id, n=n)
            if recs:
                stock_codes = json.dumps([r["stock_code"] for r in recs])
                scores = json.dumps([round(r["cf_score"], 6) for r in recs])
                rows.append((customer_id, stock_codes, scores, "als"))

        if rows:
            df = pd.DataFrame(rows, columns=["customer_id", "stock_codes", "scores", "model_name"])
            conn.register("_cf_recs", df)
            conn.execute("INSERT INTO cf_recommendations (customer_id, stock_codes, scores, model_name) SELECT customer_id, stock_codes, scores, model_name FROM _cf_recs")
        log.info(f"Cached CF recommendations for {len(rows)} customers")
