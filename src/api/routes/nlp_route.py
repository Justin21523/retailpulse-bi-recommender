"""NLP / Text Mining API routes.

GET /nlp/search?q=red+heart&n=10
GET /nlp/clusters
GET /nlp/clusters/{cluster_id}/products
GET /nlp/similar/{stock_code}
"""
from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from utils.db import get_connection
from utils.logger import get_logger

router = APIRouter()
log = get_logger(__name__)


class NLPSearchResult(BaseModel):
    stock_code: str
    description: str | None = None
    similarity_score: float


class ProductCluster(BaseModel):
    cluster_id: int
    cluster_label: str
    product_count: int
    top_keywords: str | None = None


@lru_cache(maxsize=1)
def _get_conn():
    return get_connection()


@lru_cache(maxsize=1)
def _load_search_engine():
    from models.nlp.semantic_search import SemanticSearchEngine
    engine = SemanticSearchEngine()
    conn = _get_conn()
    engine.load(conn)
    return engine


@lru_cache(maxsize=1)
def _load_clustering():
    try:
        from models.nlp.tfidf_product import ProductClustering
        return ProductClustering.load()
    except Exception as e:
        log.warning(f"TF-IDF clustering model not loaded: {e}")
        return None


@router.get("/nlp/search", response_model=list[NLPSearchResult])
def semantic_search(
    q: str = Query(..., min_length=1, max_length=200),
    n: int = Query(10, ge=1, le=50),
):
    """Semantic product search using SBERT embeddings.

    Encodes the query with all-MiniLM-L6-v2 and ranks products by cosine similarity.
    Falls back to TF-IDF keyword search if SBERT embeddings are unavailable.
    """
    engine = _load_search_engine()

    # SBERT path (primary)
    if engine._embeddings is not None:
        try:
            results = engine.search_by_text(q, n=n)
            return [NLPSearchResult(**r) for r in results]
        except Exception as e:
            log.warning(f"SBERT search failed: {e}")

    # TF-IDF fallback (keyword match)
    conn = _get_conn()
    rows = conn.execute("""
        SELECT stock_code, description
        FROM products
        WHERE LOWER(description) LIKE ?
        LIMIT ?
    """, [f"%{q.lower()}%", n]).fetchall()
    if not rows:
        raise HTTPException(status_code=404, detail=f"No products found for query: {q}")
    return [
        NLPSearchResult(stock_code=r[0], description=r[1], similarity_score=1.0)
        for r in rows
    ]


@router.get("/nlp/clusters", response_model=list[ProductCluster])
def product_clusters():
    """Return all NLP product clusters with labels and product counts."""
    conn = _get_conn()
    rows = conn.execute("""
        SELECT cluster_id, cluster_label, COUNT(*) as product_count,
               GROUP_CONCAT(top_keywords, ', ') as top_keywords
        FROM product_clusters_nlp
        GROUP BY cluster_id, cluster_label
        ORDER BY product_count DESC
    """).fetchall()
    if not rows:
        raise HTTPException(status_code=503, detail="No NLP clusters found. Run make train-nlp.")
    return [
        ProductCluster(
            cluster_id=r[0],
            cluster_label=r[1] or f"Cluster {r[0]}",
            product_count=r[2],
            top_keywords=r[3],
        )
        for r in rows
    ]


@router.get("/nlp/clusters/{cluster_id}/products", response_model=list[NLPSearchResult])
def cluster_products(
    cluster_id: int,
    limit: int = Query(20, ge=1, le=100),
):
    """Return products belonging to a specific NLP cluster."""
    conn = _get_conn()
    rows = conn.execute("""
        SELECT pc.stock_code, p.description, pc.lsa_score
        FROM product_clusters_nlp pc
        LEFT JOIN products p ON pc.stock_code = p.stock_code
        WHERE pc.cluster_id = ?
        ORDER BY pc.lsa_score DESC NULLS LAST
        LIMIT ?
    """, [cluster_id, limit]).fetchall()
    if not rows:
        raise HTTPException(status_code=404, detail=f"Cluster {cluster_id} not found.")
    return [
        NLPSearchResult(
            stock_code=r[0],
            description=r[1],
            similarity_score=round(float(r[2] or 0), 4),
        )
        for r in rows
    ]


@router.get("/nlp/similar/{stock_code}", response_model=list[NLPSearchResult])
def similar_by_description(
    stock_code: str,
    n: int = Query(10, ge=1, le=30),
):
    """Find products with semantically similar descriptions."""
    engine = _load_search_engine()
    if engine._embeddings is None:
        raise HTTPException(status_code=503, detail="SBERT embeddings unavailable. Run make train-embeddings.")
    results = engine.similar(stock_code, n=n)
    if not results:
        raise HTTPException(status_code=404, detail=f"Product {stock_code} not found in embeddings.")
    return [NLPSearchResult(**r) for r in results]
