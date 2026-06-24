"""ML Insights API routes.

GET /ml/customer/{id}/churn
GET /ml/customer/{id}/clv
GET /ml/customers/churn-risk?threshold=0.5
GET /ml/customers/anomalies?top_k=20
GET /ml/models/registry
"""
from __future__ import annotations

import json
from functools import lru_cache

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from utils.db import get_connection
from utils.logger import get_logger

router = APIRouter()
log = get_logger(__name__)


class ChurnScore(BaseModel):
    customer_id: str
    churn_probability: float
    risk_level: str          # Low / Medium / High / Critical
    segment: str | None = None
    recency_days: int | None = None


class CLVScore(BaseModel):
    customer_id: str
    predicted_clv: float     # GBP
    current_monetary: float
    segment: str | None = None


class AnomalyCustomer(BaseModel):
    customer_id: str
    anomaly_score: float
    is_anomaly: bool
    segment: str | None = None


class CustomerCLVItem(BaseModel):
    customer_id: str
    segment: str | None = None
    predicted_clv: float
    current_monetary: float


class ModelRegistryItem(BaseModel):
    model_id: str
    model_name: str
    model_type: str
    metrics: dict
    trained_at: str | None = None
    description: str | None = None


def _get_conn():
    return get_connection()


@lru_cache(maxsize=1)
def _load_churn():
    try:
        from models.deep.churn_classifier import ChurnClassifier
        return ChurnClassifier.load()
    except Exception as e:
        log.warning(f"ChurnClassifier not loaded: {e}")
        return None


@lru_cache(maxsize=1)
def _load_clv():
    try:
        from models.deep.clv_regressor import CLVRegressor
        return CLVRegressor.load()
    except Exception as e:
        log.warning(f"CLVRegressor not loaded: {e}")
        return None


@lru_cache(maxsize=1)
def _load_ae():
    try:
        from models.deep.autoencoder import CustomerAutoencoder
        return CustomerAutoencoder.load()
    except Exception as e:
        log.warning(f"CustomerAutoencoder not loaded: {e}")
        return None


@router.get("/ml/customer/{customer_id}/churn", response_model=ChurnScore)
def customer_churn(customer_id: str):
    """Predict churn probability for a single customer."""
    model = _load_churn()
    if model is None:
        raise HTTPException(status_code=503, detail="Churn model not available. Run make train-dl.")
    conn = _get_conn()
    try:
        preds = model.predict_from_conn(conn).to_dict("records")
        row = next((r for r in preds if str(r["customer_id"]) == customer_id), None)
        if row is None:
            raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found.")
        return ChurnScore(
            customer_id=str(row["customer_id"]),
            churn_probability=float(row["churn_probability"]),
            risk_level=str(row["risk_level"]),
        )
    finally:
        conn.close()


@router.get("/ml/customer/{customer_id}/clv", response_model=CLVScore)
def customer_clv(customer_id: str):
    """Predict Customer Lifetime Value for a single customer."""
    model = _load_clv()
    if model is None:
        raise HTTPException(status_code=503, detail="CLV model not available. Run make train-dl.")
    conn = _get_conn()
    try:
        preds = model.predict_from_conn(conn).to_dict("records")
        row = next((r for r in preds if str(r["customer_id"]) == customer_id), None)
        if row is None:
            raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found.")
        # Fetch monetary from customer_features for context
        monetary_row = conn.execute(
            "SELECT monetary FROM customer_features WHERE customer_id = ?", [customer_id]
        ).fetchone()
        return CLVScore(
            customer_id=str(row["customer_id"]),
            predicted_clv=float(row["predicted_clv"]),
            current_monetary=float(monetary_row[0]) if monetary_row else 0.0,
        )
    finally:
        conn.close()


@router.get("/ml/customers/churn-risk", response_model=list[ChurnScore])
def customers_churn_risk(
    threshold: float = Query(0.5, ge=0.0, le=1.0),
    limit: int = Query(50, ge=1, le=500),
):
    """Return customers with churn probability above threshold, enriched with segment."""
    model = _load_churn()
    if model is None:
        raise HTTPException(status_code=503, detail="Churn model not available. Run make train-dl.")
    conn = _get_conn()
    try:
        preds_df = model.predict_from_conn(conn)
        meta = conn.execute(
            "SELECT customer_id, recency_days, segment FROM customer_features"
        ).df()
        merged = preds_df.merge(meta, on="customer_id", how="left")
        high_risk = (
            merged[merged["churn_probability"] >= threshold]
            .sort_values("churn_probability", ascending=False)
            .head(limit)
        )
        return [ChurnScore(
            customer_id=str(r["customer_id"]),
            churn_probability=float(r["churn_probability"]),
            risk_level=str(r["risk_level"]),
            segment=r.get("segment"),
            recency_days=int(r["recency_days"]) if r.get("recency_days") is not None else None,
        ) for _, r in high_risk.iterrows()]
    finally:
        conn.close()


@router.get("/ml/customers/anomalies", response_model=list[AnomalyCustomer])
def customer_anomalies(top_k: int = Query(20, ge=1, le=100)):
    """Return top-K anomalous customers from Autoencoder, enriched with segment."""
    model = _load_ae()
    if model is None:
        raise HTTPException(status_code=503, detail="Autoencoder not available. Run make train-dl.")
    conn = _get_conn()
    try:
        anomalies_df = model.predict_from_conn(conn, top_k=top_k)
        meta = conn.execute("SELECT customer_id, segment FROM customer_features").df()
        merged = anomalies_df.merge(meta, on="customer_id", how="left")
        return [
            AnomalyCustomer(
                customer_id=str(r["customer_id"]),
                anomaly_score=float(r["anomaly_score"]),
                is_anomaly=bool(r["is_anomaly"]),
                segment=r.get("segment"),
            )
            for _, r in merged.iterrows()
        ]
    finally:
        conn.close()


@router.get("/ml/customers/clv-ranking", response_model=list[CustomerCLVItem])
def customers_clv_ranking(limit: int = Query(10, ge=1, le=100)):
    """Return top customers ranked by predicted CLV."""
    model = _load_clv()
    if model is None:
        raise HTTPException(status_code=503, detail="CLV model not available. Run make train-dl.")
    conn = _get_conn()
    try:
        preds_df = model.predict_from_conn(conn)
        meta = conn.execute(
            "SELECT customer_id, monetary, segment FROM customer_features"
        ).df()
        merged = preds_df.merge(meta, on="customer_id", how="left").nlargest(limit, "predicted_clv")
        return [CustomerCLVItem(
            customer_id=str(r["customer_id"]),
            segment=r.get("segment"),
            predicted_clv=float(r["predicted_clv"]),
            current_monetary=float(r.get("monetary", 0)),
        ) for _, r in merged.iterrows()]
    finally:
        conn.close()


@router.get("/ml/models/churn/roc")
def churn_roc_curve():
    """Compute ROC curve points for the ChurnClassifier at 21 thresholds (0.0–1.0)."""
    model = _load_churn()
    if model is None:
        raise HTTPException(status_code=503, detail="Churn model not available. Run make train-dl.")
    conn = _get_conn()
    try:
        preds_df = model.predict_from_conn(conn)
        meta = conn.execute("SELECT customer_id, recency_days FROM customer_features").df()
        merged = preds_df.merge(meta, on="customer_id", how="inner")
        merged["true_label"] = (merged["recency_days"] > 180).astype(int)
        points = []
        for i in range(21):
            t = i / 20.0
            preds = (merged["churn_probability"] >= t).astype(int)
            tp = int(((preds == 1) & (merged["true_label"] == 1)).sum())
            fp = int(((preds == 1) & (merged["true_label"] == 0)).sum())
            tn = int(((preds == 0) & (merged["true_label"] == 0)).sum())
            fn = int(((preds == 0) & (merged["true_label"] == 1)).sum())
            tpr = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
            points.append({"threshold": round(t, 2), "fpr": round(fpr, 4), "tpr": round(tpr, 4),
                            "tp": tp, "fp": fp, "tn": tn, "fn": fn})
        return points
    finally:
        conn.close()


@router.get("/ml/customers/all-churn")
def all_customers_churn():
    """Return churn probability for every customer (for distribution charts)."""
    model = _load_churn()
    if model is None:
        raise HTTPException(status_code=503, detail="Churn model not available. Run make train-dl.")
    conn = _get_conn()
    try:
        preds_df = model.predict_from_conn(conn)
        meta = conn.execute("SELECT customer_id, segment FROM customer_features").df()
        merged = preds_df.merge(meta, on="customer_id", how="left")
        return [{"customer_id": str(r["customer_id"]),
                 "churn_probability": float(r["churn_probability"]),
                 "risk_level": str(r["risk_level"]),
                 "segment": r.get("segment")}
                for _, r in merged.iterrows()]
    finally:
        conn.close()


@router.get("/ml/customers/{customer_id}/purchase-history")
def customer_purchase_history(customer_id: str):
    """Monthly purchase totals for anomaly customer deep dive panel."""
    conn = _get_conn()
    try:
        rows = conn.execute("""
            SELECT strftime('%Y-%m', i.invoice_date) AS month,
                   ROUND(SUM(ii.line_total), 2) AS revenue
            FROM invoices i
            JOIN invoice_items ii ON ii.invoice_no = i.invoice_no
            WHERE i.customer_id = ?
              AND ii.quantity > 0
              AND ii.unit_price > 0
            GROUP BY 1
            ORDER BY 1
        """, [customer_id]).fetchall()
        return [{"month": r[0], "revenue": float(r[1])} for r in rows]
    except Exception as e:
        log.warning(f"purchase history error for {customer_id}: {e}")
        return []
    finally:
        conn.close()


@router.get("/ml/models/registry", response_model=list[ModelRegistryItem])
def model_registry():
    """Return all trained model metadata from model_registry."""
    conn = _get_conn()
    try:
        rows = conn.execute("""
            SELECT model_id, model_name, model_type, metrics, trained_at, description
            FROM model_registry
            ORDER BY trained_at DESC NULLS LAST
        """).fetchall()
        return [
            ModelRegistryItem(
                model_id=r[0],
                model_name=r[1],
                model_type=r[2],
                metrics=json.loads(r[3] or "{}"),
                trained_at=str(r[4]) if r[4] else None,
                description=r[5],
            )
            for r in rows
        ]
    finally:
        conn.close()
