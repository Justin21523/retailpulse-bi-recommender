"""A/B Testing API routes.

GET  /ab/experiments
POST /ab/experiments
GET  /ab/experiments/{id}/results
POST /ab/events
POST /ab/experiments/{id}/analyze
GET  /ab/sample-size
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ab_testing.experiment import ABExperiment
from ab_testing.stats import required_sample_size
from ab_testing.storage import get_results, list_experiments, save_result
from utils.db import get_connection
from utils.logger import get_logger

router = APIRouter()
log = get_logger(__name__)


class CreateExperimentRequest(BaseModel):
    name: str
    description: str = ""
    variants: list[str] = ["control", "treatment"]


class RecordEventRequest(BaseModel):
    experiment_id: str
    variant: str
    event_type: str   # "impression" | "click" | "conversion"
    user_id: str | None = None
    value: float = 1.0


class ABResultResponse(BaseModel):
    experiment_id: str
    metric: str
    control_variant: str
    treatment_variant: str
    control_rate: float
    treatment_rate: float
    p_value: float
    effect_size: float
    significant: bool


def _get_conn():
    return get_connection()


@router.get("/ab/experiments")
def get_experiments():
    """List all A/B experiments."""
    import json as _json
    conn = _get_conn()
    try:
        df = list_experiments(conn)
        records = df.to_dict("records")
        for r in records:
            if isinstance(r.get("variants"), str):
                try:
                    r["variants"] = _json.loads(r["variants"])
                except Exception:
                    r["variants"] = []
        return records
    finally:
        conn.close()


@router.post("/ab/experiments", status_code=201)
def create_experiment(payload: CreateExperimentRequest):
    """Create and persist a new A/B experiment."""
    conn = _get_conn()
    try:
        exp = ABExperiment(
            name=payload.name,
            description=payload.description,
            variants=payload.variants,
        )
        exp.save(conn)
        return {"experiment_id": exp.experiment_id, "name": exp.name, "variants": exp.variants}
    finally:
        conn.close()


@router.post("/ab/events", status_code=201)
def record_event(payload: RecordEventRequest):
    """Record an A/B test event (impression, click, or conversion)."""
    conn = _get_conn()
    try:
        try:
            exp = ABExperiment.load(conn, payload.experiment_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        exp.record_event(
            conn,
            variant=payload.variant,
            event_type=payload.event_type,
            user_id=payload.user_id,
            value=payload.value,
        )
        return {"status": "ok"}
    finally:
        conn.close()


@router.post("/ab/experiments/{experiment_id}/analyze", response_model=ABResultResponse)
def analyze_experiment(
    experiment_id: str,
    metric: str = Query("conversion_rate", pattern="^(conversion_rate|mean_value)$"),
    alpha: float = Query(0.05, ge=0.01, le=0.1),
):
    """Compute statistical significance for an experiment and persist the result."""
    conn = _get_conn()
    try:
        try:
            exp = ABExperiment.load(conn, experiment_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))

        result = exp.compute_statistics(conn, metric=metric, alpha=alpha)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])

        save_result(conn, experiment_id, result)
        return ABResultResponse(**result)
    finally:
        conn.close()


@router.get("/ab/experiments/{experiment_id}/results", response_model=list[ABResultResponse])
def get_experiment_results(experiment_id: str):
    """Return all computed statistical results for an experiment."""
    conn = _get_conn()
    try:
        df = get_results(conn, experiment_id)
        if df.empty:
            return []
        return df.to_dict("records")
    finally:
        conn.close()


@router.get("/ab/experiments/{experiment_id}/summary")
def experiment_summary(experiment_id: str):
    """Return per-variant event counts and conversion counts."""
    conn = _get_conn()
    try:
        try:
            ABExperiment.load(conn, experiment_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        df = conn.execute("""
            SELECT variant,
                   COUNT(*) AS total_events,
                   SUM(CASE WHEN event_type = 'conversion' THEN 1 ELSE 0 END) AS conversions,
                   SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END) AS impressions
            FROM ab_events WHERE experiment_id = ?
            GROUP BY variant
        """, [experiment_id]).df()
        return df.to_dict("records")
    finally:
        conn.close()


@router.get("/ab/sample-size")
def sample_size_calculator(
    baseline_rate: float = Query(..., ge=0.001, le=0.999),
    mde: float = Query(0.01, ge=0.001, le=0.5),
    power: float = Query(0.8, ge=0.5, le=0.99),
    alpha: float = Query(0.05, ge=0.01, le=0.1),
):
    """Calculate the required sample size per variant for a two-proportion test."""
    n = required_sample_size(baseline_rate, mde, power=power, alpha=alpha)
    return {
        "n_per_variant": n,
        "baseline_rate": baseline_rate,
        "mde": mde,
        "power": power,
        "alpha": alpha,
        "expected_treatment_rate": round(baseline_rate + mde, 4),
    }
