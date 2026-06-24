"""Tree-based ML routes.

GET /tree/churn/compare       → comparison table (DT / RF / GBT / MLP)
GET /tree/feature-importance  → Random Forest feature importances
"""
from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.db import get_connection
from utils.logger import get_logger

router = APIRouter()
log = get_logger(__name__)


class ModelComparisonItem(BaseModel):
    model_name: str
    model_type: str
    auc_roc: float
    f1: float
    precision: float
    recall: float


class FeatureImportanceItem(BaseModel):
    feature: str
    importance: float
    rank: int


@lru_cache(maxsize=1)
def _get_conn():
    return get_connection()


@router.get("/tree/churn/compare", response_model=list[ModelComparisonItem])
def churn_model_compare():
    """Return AUC-ROC / F1 / Precision / Recall for DT, RF, GBT and MLP churn models."""
    try:
        from models.tree_models import ChurnTreeEnsemble
    except ImportError as exc:
        raise HTTPException(status_code=500, detail=f"Import error: {exc}")

    conn = _get_conn()
    try:
        items = ChurnTreeEnsemble.compare(conn)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        log.exception("churn_model_compare failed")
        raise HTTPException(status_code=500, detail=str(exc))

    return [ModelComparisonItem(**item) for item in items]


@router.get("/tree/feature-importance", response_model=list[FeatureImportanceItem])
def feature_importance():
    """Return Random Forest feature importances sorted by importance descending."""
    try:
        from models.tree_models import ChurnTreeEnsemble
    except ImportError as exc:
        raise HTTPException(status_code=500, detail=f"Import error: {exc}")

    try:
        items = ChurnTreeEnsemble.feature_importances()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        log.exception("feature_importance failed")
        raise HTTPException(status_code=500, detail=str(exc))

    return [FeatureImportanceItem(**item) for item in items]
