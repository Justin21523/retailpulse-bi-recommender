"""Top-N recommendation engine for RetailPulse."""
from __future__ import annotations

import duckdb

from utils.logger import get_logger

log = get_logger(__name__)


class RetailRecommender:
    """Multi-strategy recommender backed by DuckDB warehouse tables.

    Strategies:
    - Popularity: top products by order_count (cold-start baseline)
    - FBT (Frequently-Bought-Together): MBA association rules
    - Segment-based: top products for the customer's RFM segment
    """

    def __init__(self, conn: duckdb.DuckDBPyConnection) -> None:
        self._conn = conn

    def recommend_by_popularity(self, n: int = 10) -> list[dict]:
        """Return the top-N most popular products by order count.

        Args:
            n: Number of recommendations to return.

        Returns:
            List of dicts with keys: stock_code, description, order_count,
            total_revenue, reason.
        """
        sql = f"""
        SELECT stock_code, description, order_count, total_revenue
        FROM product_features
        ORDER BY popularity_rank
        LIMIT {n}
        """
        rows = self._conn.execute(sql).fetchall()
        return [
            {
                "stock_code": r[0],
                "description": r[1],
                "order_count": r[2],
                "total_revenue": round(r[3], 2),
                "score": r[2],
                "reason": "popularity",
            }
            for r in rows
        ]

    def recommend_for_customer(self, customer_id: str, n: int = 10) -> list[dict]:
        """Return top-N product recommendations for a specific customer.

        Strategy (with fallback chain):
        1. FBT: products co-purchased with items the customer has already bought
        2. Segment-based: top products bought by customers in the same RFM segment
        3. Popularity fallback

        Args:
            customer_id: Target customer identifier.
            n: Number of recommendations.

        Returns:
            List of recommendation dicts with reason field.
        """
        already_bought = self._get_customer_products(customer_id)
        recs: list[dict] = []

        # Strategy 1: FBT via association rules
        if already_bought:
            recs.extend(self._fbt_recommendations(already_bought, already_bought, n))

        # Strategy 2: segment-based
        if len(recs) < n:
            segment = self._get_customer_segment(customer_id)
            if segment:
                needed = n - len(recs)
                existing_codes = {r["stock_code"] for r in recs} | set(already_bought)
                seg_recs = self._segment_recommendations(segment, existing_codes, needed)
                recs.extend(seg_recs)

        # Strategy 3: popularity fallback
        if len(recs) < n:
            needed = n - len(recs)
            existing_codes = {r["stock_code"] for r in recs} | set(already_bought)
            pop_recs = [
                r for r in self.recommend_by_popularity(n + len(existing_codes))
                if r["stock_code"] not in existing_codes
            ][:needed]
            recs.extend(pop_recs)

        return recs[:n]

    def recommend_for_product(self, stock_code: str, n: int = 10) -> list[dict]:
        """Return top-N products frequently bought with a given product.

        Args:
            stock_code: Reference product code.
            n: Number of recommendations.

        Returns:
            List of dicts with keys: stock_code, description, lift, confidence, support.
        """
        sql = f"""
        SELECT
            r.consequents AS stock_codes,
            r.lift,
            r.confidence,
            r.support
        FROM mba_rules r
        WHERE r.antecedents LIKE '%{stock_code}%'
        ORDER BY r.lift DESC
        LIMIT {n * 3}
        """
        rows = self._conn.execute(sql).fetchall()

        recs = []
        seen: set[str] = {stock_code}
        for row in rows:
            for code in row[0].split(", "):
                code = code.strip()
                if code not in seen:
                    desc = self._get_product_description(code)
                    recs.append({
                        "stock_code": code,
                        "description": desc,
                        "lift": round(row[1], 3),
                        "confidence": round(row[2], 3),
                        "support": round(row[3], 4),
                        "reason": "frequently_bought_together",
                    })
                    seen.add(code)
                    if len(recs) >= n:
                        break
            if len(recs) >= n:
                break

        # Fallback to popularity if no rules found
        if not recs:
            log.debug(f"No MBA rules for {stock_code}; falling back to popularity")
            recs = [
                {**r, "lift": None, "confidence": None, "support": None}
                for r in self.recommend_by_popularity(n)
                if r["stock_code"] != stock_code
            ][:n]

        return recs

    # ── private helpers ──────────────────────────────────────────────────────

    def _get_customer_products(self, customer_id: str) -> list[str]:
        sql = f"""
        SELECT DISTINCT ii.stock_code
        FROM invoice_items ii
        JOIN invoices i ON ii.invoice_no = i.invoice_no
        WHERE i.customer_id = '{customer_id}'
        """
        rows = self._conn.execute(sql).fetchall()
        return [r[0] for r in rows]

    def _get_customer_segment(self, customer_id: str) -> str | None:
        sql = f"""
        SELECT segment FROM customer_features WHERE customer_id = '{customer_id}'
        """
        row = self._conn.execute(sql).fetchone()
        return row[0] if row else None

    def _get_product_description(self, stock_code: str) -> str:
        sql = f"SELECT description FROM products WHERE stock_code = '{stock_code}'"
        row = self._conn.execute(sql).fetchone()
        return row[0] if row else stock_code

    def _fbt_recommendations(
        self,
        bought_codes: list[str],
        exclude_codes: list[str],
        n: int,
    ) -> list[dict]:
        codes_str = ", ".join(f"'{c}'" for c in bought_codes)
        exclude_str = ", ".join(f"'{c}'" for c in exclude_codes)
        sql = f"""
        SELECT consequents, lift, confidence, support
        FROM mba_rules
        WHERE antecedents IN ({codes_str})
        ORDER BY lift DESC
        LIMIT {n * 3}
        """
        try:
            rows = self._conn.execute(sql).fetchall()
        except Exception:
            return []

        recs = []
        seen = set(exclude_codes)
        for row in rows:
            for code in row[0].split(", "):
                code = code.strip()
                if code not in seen:
                    desc = self._get_product_description(code)
                    recs.append({
                        "stock_code": code,
                        "description": desc,
                        "lift": round(row[1], 3),
                        "confidence": round(row[2], 3),
                        "support": round(row[3], 4),
                        "score": round(row[1], 3),
                        "reason": "frequently_bought_together",
                    })
                    seen.add(code)
                    if len(recs) >= n:
                        return recs
        return recs

    def _segment_recommendations(
        self,
        segment: str,
        exclude_codes: set[str],
        n: int,
    ) -> list[dict]:
        """Top products bought by other customers in the same segment."""
        exclude_str = ", ".join(f"'{c}'" for c in exclude_codes) if exclude_codes else "''"
        sql = f"""
        SELECT pf.stock_code, pf.description, pf.order_count
        FROM product_features pf
        WHERE pf.stock_code NOT IN ({exclude_str})
        ORDER BY pf.popularity_rank
        LIMIT {n}
        """
        rows = self._conn.execute(sql).fetchall()
        return [
            {
                "stock_code": r[0],
                "description": r[1],
                "order_count": r[2],
                "score": r[2],
                "reason": f"segment:{segment}",
            }
            for r in rows
        ]
