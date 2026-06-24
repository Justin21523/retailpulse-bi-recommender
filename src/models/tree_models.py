"""Tree-based ensemble models for churn prediction and comparison.

Trains DecisionTree, RandomForest, and GradientBoosting classifiers
on RFM features from the customer_features table.

Label definition: churn = 1 if recency_days > 180 else 0
Features: recency_days, frequency, monetary, r_score, f_score, m_score

Mirrors the same label/feature convention used by models.deep.churn_classifier.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import duckdb
import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import (
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier

from utils.logger import get_logger

log = get_logger(__name__)

_MODELS_DIR = Path(__file__).parent.parent.parent / "data" / "models"
_FEATURE_COLS = ["recency_days", "frequency", "monetary", "r_score", "f_score", "m_score"]
_CHURN_THRESHOLD_DAYS = 180

# Registry name used by the MLP ChurnClassifier (see training/train_dl.py)
_MLP_CHURN_REGISTRY_NAME = "churn_classifier"


class ChurnTreeEnsemble:
    """Decision Tree, Random Forest, and Gradient Boosting churn classifiers.

    All models share the same feature set and label definition as the MLP
    ChurnClassifier, enabling apples-to-apples comparison.
    """

    MODEL_CONFIGS: dict[str, dict] = {
        "decision_tree": {
            "cls": DecisionTreeClassifier,
            "params": {"max_depth": 5, "random_state": 42},
            "pkl": "decision_tree.pkl",
            "model_id": "dt_v1",
            "model_type_label": "Decision Tree",
            "description": "Decision Tree (max_depth=5) for 180-day churn prediction",
        },
        "random_forest": {
            "cls": RandomForestClassifier,
            "params": {"n_estimators": 100, "random_state": 42, "n_jobs": -1},
            "pkl": "random_forest.pkl",
            "model_id": "rf_v1",
            "model_type_label": "Random Forest",
            "description": "Random Forest (100 trees) for 180-day churn prediction",
        },
        "gradient_boosting": {
            "cls": GradientBoostingClassifier,
            "params": {"n_estimators": 100, "random_state": 42},
            "pkl": "gradient_boosting.pkl",
            "model_id": "gbt_v1",
            "model_type_label": "Gradient Boosting",
            "description": "Gradient Boosting (100 estimators) for 180-day churn prediction",
        },
    }

    # ── Private helpers ────────────────────────────────────────────────────

    @classmethod
    def _load_data(cls, conn: duckdb.DuckDBPyConnection) -> tuple[np.ndarray, np.ndarray]:
        """Fetch RFM features and churn labels from customer_features."""
        cols = ", ".join(_FEATURE_COLS)
        df = conn.execute(f"SELECT {cols} FROM customer_features").df()
        X = df[_FEATURE_COLS].values.astype(np.float64)
        y = (df["recency_days"] > _CHURN_THRESHOLD_DAYS).astype(int).values
        return X, y

    @classmethod
    def _eval_metrics(
        cls,
        model,
        X_test: np.ndarray,
        y_test: np.ndarray,
        name: str,
    ) -> dict:
        """Compute AUC-ROC, F1, Precision, Recall and feature importances."""
        probs = model.predict_proba(X_test)[:, 1]
        preds = (probs >= 0.5).astype(int)

        try:
            auc = float(roc_auc_score(y_test, probs))
        except Exception:
            auc = 0.5

        f1 = float(f1_score(y_test, preds, zero_division=0))
        precision = float(precision_score(y_test, preds, zero_division=0))
        recall = float(recall_score(y_test, preds, zero_division=0))

        metrics: dict = {
            "auc_roc": round(auc, 4),
            "f1": round(f1, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
        }

        if hasattr(model, "feature_importances_"):
            metrics["feature_importances"] = {
                col: round(float(imp), 6)
                for col, imp in zip(_FEATURE_COLS, model.feature_importances_)
            }

        log.info(
            f"{name}: AUC={auc:.4f}  F1={f1:.4f}  "
            f"Precision={precision:.4f}  Recall={recall:.4f}"
        )
        return metrics

    # ── Public API ─────────────────────────────────────────────────────────

    @classmethod
    def train(cls, conn: duckdb.DuckDBPyConnection) -> dict[str, dict]:
        """Train all 3 tree classifiers, save pkl artifacts and registry entries.

        Args:
            conn: Open DuckDB connection with customer_features table.

        Returns:
            Mapping of model_name → metrics dict (includes feature_importances for RF).
        """
        _MODELS_DIR.mkdir(parents=True, exist_ok=True)

        X, y = cls._load_data(conn)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        results: dict[str, dict] = {}

        for name, cfg in cls.MODEL_CONFIGS.items():
            log.info(f"Training {name}...")
            model = cfg["cls"](**cfg["params"])
            model.fit(X_train, y_train)

            metrics = cls._eval_metrics(model, X_test, y_test, name)

            pkl_path = _MODELS_DIR / cfg["pkl"]
            joblib.dump(model, pkl_path)
            log.info(f"Saved → {pkl_path}")

            conn.execute(
                """
                INSERT OR REPLACE INTO model_registry
                    (model_id, model_name, model_type, metrics,
                     artifact_path, trained_at, description)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    cfg["model_id"],
                    name,
                    "supervised_classification",
                    json.dumps(metrics),
                    str(pkl_path),
                    datetime.now(timezone.utc).isoformat(),
                    cfg["description"],
                ],
            )

            results[name] = metrics

        log.info("Tree ensemble training complete.")
        return results

    @classmethod
    def load_model(cls, name: str):
        """Load a single trained tree model from its pkl file.

        Args:
            name: One of 'decision_tree', 'random_forest', 'gradient_boosting'.

        Raises:
            ValueError: Unknown model name.
            FileNotFoundError: Artifact not found — run 'make train-tree' first.
        """
        cfg = cls.MODEL_CONFIGS.get(name)
        if cfg is None:
            raise ValueError(
                f"Unknown model '{name}'. Choose from {list(cls.MODEL_CONFIGS)}"
            )
        pkl_path = _MODELS_DIR / cfg["pkl"]
        if not pkl_path.exists():
            raise FileNotFoundError(
                f"Model artifact not found: {pkl_path}. Run 'make train-tree' first."
            )
        return joblib.load(pkl_path)

    @classmethod
    def compare(cls, conn: duckdb.DuckDBPyConnection) -> list[dict]:
        """Return comparison metrics for all tree models + MLP ChurnClassifier.

        Reads metrics from model_registry (stored at training time) and verifies
        pkl files exist so callers get a clear error if training hasn't run.

        Args:
            conn: Open DuckDB connection with model_registry table.

        Returns:
            List of dicts with keys: model_name, model_type, auc_roc, f1, precision, recall.

        Raises:
            FileNotFoundError: If any tree model pkl is missing.
        """
        # Verify all pkl files are present before fetching from registry
        missing = [
            cfg["pkl"]
            for cfg in cls.MODEL_CONFIGS.values()
            if not (_MODELS_DIR / cfg["pkl"]).exists()
        ]
        if missing:
            raise FileNotFoundError(
                f"Tree model artifacts not found ({', '.join(missing)}). "
                "Run 'make train-tree' first."
            )

        comparison: list[dict] = []

        # Tree models — read stored metrics from registry
        for name, cfg in cls.MODEL_CONFIGS.items():
            row = conn.execute(
                "SELECT metrics FROM model_registry WHERE model_name = ? LIMIT 1",
                [name],
            ).fetchone()
            m: dict = json.loads(row[0] or "{}") if row else {}
            comparison.append(
                {
                    "model_name": name,
                    "model_type": cfg["model_type_label"],
                    "auc_roc": round(float(m.get("auc_roc", 0.0)), 4),
                    "f1": round(float(m.get("f1", 0.0)), 4),
                    "precision": round(float(m.get("precision", 0.0)), 4),
                    "recall": round(float(m.get("recall", 0.0)), 4),
                }
            )

        # MLP ChurnClassifier — read from registry (no pkl needed here)
        row = conn.execute(
            """
            SELECT model_name, metrics
            FROM model_registry
            WHERE model_name IN (?, ?)
            ORDER BY trained_at DESC NULLS LAST
            LIMIT 1
            """,
            [_MLP_CHURN_REGISTRY_NAME, "ChurnClassifier"],
        ).fetchone()
        if row:
            m = json.loads(row[1] or "{}")
            comparison.append(
                {
                    "model_name": row[0],
                    "model_type": "MLP Neural Network",
                    "auc_roc": round(float(m.get("auc_roc", 0.0)), 4),
                    "f1": round(float(m.get("f1", 0.0)), 4),
                    "precision": round(float(m.get("precision", 0.0)), 4),
                    "recall": round(float(m.get("recall", 0.0)), 4),
                }
            )

        return comparison

    @classmethod
    def feature_importances(cls) -> list[dict]:
        """Return Random Forest feature importances sorted by importance descending.

        Returns:
            List of dicts with keys: feature, importance, rank.

        Raises:
            FileNotFoundError: If random_forest.pkl does not exist.
        """
        rf_path = _MODELS_DIR / "random_forest.pkl"
        if not rf_path.exists():
            raise FileNotFoundError(
                f"Random Forest artifact not found: {rf_path}. "
                "Run 'make train-tree' first."
            )
        rf = joblib.load(rf_path)
        ranked = sorted(
            zip(_FEATURE_COLS, rf.feature_importances_),
            key=lambda x: x[1],
            reverse=True,
        )
        return [
            {"feature": feat, "importance": round(float(imp), 6), "rank": rank + 1}
            for rank, (feat, imp) in enumerate(ranked)
        ]
