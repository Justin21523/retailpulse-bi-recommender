"""Collaborative Filtering & Bandit recommendation routes.

GET /recommendations/cf/{customer_id}
GET /recommendations/similar/{stock_code}
GET /recommendations/bandit/{customer_id}
POST /recommendations/bandit/reward
"""
from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from utils.db import get_connection
from utils.logger import get_logger

router = APIRouter()
log = get_logger(__name__)


class CFRecommendation(BaseModel):
    stock_code: str
    description: str | None = None
    cf_score: float
    reason: str


class BanditRecommendationResponse(BaseModel):
    customer_id: str
    arm: str
    recommendations: list[CFRecommendation]
    arm_stats: dict


class BanditRewardRequest(BaseModel):
    customer_id: str
    arm: str
    reward: float  # 1.0 = converted, 0.0 = not converted


@lru_cache(maxsize=1)
def _get_conn():
    return get_connection()


@lru_cache(maxsize=1)
def _load_als():
    try:
        from models.collaborative.als_recommender import ALSRecommender
        return ALSRecommender.load()
    except Exception as e:
        log.warning(f"ALS not loaded: {e}")
        return None


@lru_cache(maxsize=1)
def _load_bandit():
    from models.deep.bandit import ThompsonSamplingBandit
    return ThompsonSamplingBandit.load()


@router.get("/recommendations/cf/{customer_id}", response_model=list[CFRecommendation])
def cf_recommendations(
    customer_id: str,
    n: int = Query(10, ge=1, le=50),
):
    """ALS collaborative filtering recommendations for a customer.

    Falls back to pre-cached DuckDB recommendations if model is unavailable.
    """
    conn = _get_conn()
    # First try cached recommendations in DuckDB
    row = conn.execute(
        "SELECT stock_codes, scores FROM cf_recommendations WHERE customer_id = ?",
        [customer_id],
    ).fetchone()

    if row:
        import json
        codes = json.loads(row[0] or "[]")[:n]
        scores = json.loads(row[1] or "[]")[:n]
        results = []
        for code, score in zip(codes, scores):
            desc = conn.execute(
                "SELECT description FROM products WHERE stock_code = ?", [code]
            ).fetchone()
            results.append(CFRecommendation(
                stock_code=code,
                description=desc[0] if desc else None,
                cf_score=round(float(score), 4),
                reason="cf_als_cached",
            ))
        return results

    # Live ALS inference fallback
    model = _load_als()
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="CF model not available. Run make train-cf.",
        )
    recs = model.recommend(customer_id, n=n)
    return [CFRecommendation(**r) for r in recs]


@router.get("/recommendations/similar/{stock_code}", response_model=list[CFRecommendation])
def similar_products(
    stock_code: str,
    n: int = Query(10, ge=1, le=30),
):
    """Find similar products using Item2Vec or SBERT embeddings."""
    conn = _get_conn()

    # Try Item2Vec first
    try:
        from models.deep.item2vec import Item2VecModel
        i2v = Item2VecModel.load()
        similar = i2v.similar_products(stock_code, n=n)
        if similar:
            results = []
            for code, sim_score in similar:
                desc = conn.execute(
                    "SELECT description FROM products WHERE stock_code = ?", [code]
                ).fetchone()
                results.append(CFRecommendation(
                    stock_code=code,
                    description=desc[0] if desc else None,
                    cf_score=round(float(sim_score), 4),
                    reason="item2vec_cosine",
                ))
            return results
    except Exception:
        pass

    # Fallback to SBERT semantic similarity
    try:
        from models.nlp.semantic_search import SemanticSearchEngine
        engine = SemanticSearchEngine().load(conn)
        similar = engine.similar(stock_code, n=n)
        if similar:
            return [
                CFRecommendation(
                    stock_code=r["stock_code"],
                    description=r["description"],
                    cf_score=round(r["similarity_score"], 4),
                    reason="sbert_semantic",
                )
                for r in similar
            ]
    except Exception:
        pass

    raise HTTPException(status_code=503, detail="Similarity model unavailable. Run make train-embeddings.")


@router.get("/recommendations/bandit/{customer_id}", response_model=BanditRecommendationResponse)
def bandit_recommendation(customer_id: str, n: int = Query(10, ge=1, le=20)):
    """Thompson Sampling bandit: select best recommendation strategy for this customer."""
    bandit = _load_bandit()
    arm = bandit.select_arm()
    conn = _get_conn()
    recs = _get_arm_recommendations(conn, customer_id, arm, n)
    return BanditRecommendationResponse(
        customer_id=customer_id,
        arm=arm,
        recommendations=recs,
        arm_stats=bandit.arm_stats(),
    )


def _get_arm_recommendations(conn, customer_id: str, arm: str, n: int) -> list[CFRecommendation]:
    """Dispatch to the correct strategy for the selected bandit arm."""
    if arm == "popularity":
        rows = conn.execute("""
            SELECT pf.stock_code, p.description, pf.total_revenue
            FROM product_features pf
            LEFT JOIN products p ON pf.stock_code = p.stock_code
            ORDER BY pf.total_revenue DESC LIMIT ?
        """, [n]).fetchall()
        return [
            CFRecommendation(
                stock_code=r[0], description=r[1],
                cf_score=round(float(r[2] or 0), 2), reason="popularity",
            )
            for r in rows
        ]

    if arm in ("cf_als", "segment"):
        # Reuse CF route logic
        row = conn.execute(
            "SELECT stock_codes, scores FROM cf_recommendations WHERE customer_id = ?",
            [customer_id],
        ).fetchone()
        if row:
            import json
            codes = json.loads(row[0] or "[]")[:n]
            scores = json.loads(row[1] or "[]")[:n]
            results = []
            for code, score in zip(codes, scores):
                desc = conn.execute("SELECT description FROM products WHERE stock_code = ?", [code]).fetchone()
                results.append(CFRecommendation(
                    stock_code=code, description=desc[0] if desc else None,
                    cf_score=round(float(score), 4), reason=arm,
                ))
            return results

    # Default: popular items
    rows = conn.execute("""
        SELECT pf.stock_code, p.description, pf.total_revenue
        FROM product_features pf
        LEFT JOIN products p ON pf.stock_code = p.stock_code
        ORDER BY pf.total_revenue DESC LIMIT ?
    """, [n]).fetchall()
    return [
        CFRecommendation(stock_code=r[0], description=r[1],
                         cf_score=round(float(r[2] or 0), 2), reason="fallback_popularity")
        for r in rows
    ]


@router.post("/recommendations/bandit/reward")
def bandit_reward(payload: BanditRewardRequest):
    """Record a reward signal to update the Thompson Sampling bandit state."""
    bandit = _load_bandit()
    bandit.update(payload.arm, payload.reward)
    bandit.save()
    return {"status": "ok", "arm": payload.arm, "best_arm": bandit.best_arm()}
