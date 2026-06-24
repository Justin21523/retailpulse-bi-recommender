"""自動生成商業洞察，從 DuckDB 倉儲提取最重要的 5 條 insight。"""
from __future__ import annotations

import duckdb

from utils.logger import get_logger

log = get_logger(__name__)


def generate_insights(conn: duckdb.DuckDBPyConnection) -> list[dict]:
    """從 DuckDB 分析倉儲自動產生 5 條商業洞察。

    每條洞察包含：type, title, description, value, icon。
    設計原則：每條都是「可直接說給面試官聽」的 fact，不是技術指標。
    """
    insights: list[dict] = []

    # ── 1. 帕累托：前 20% 客戶佔多少收入 ────────────────────────────────────
    try:
        total_customers = conn.execute("SELECT COUNT(*) FROM customer_features").fetchone()[0]
        top_20_pct_count = max(1, int(total_customers * 0.2))

        top_revenue = conn.execute(
            """
            SELECT SUM(monetary) FROM (
                SELECT monetary FROM customer_features ORDER BY monetary DESC LIMIT ?
            )
            """,
            [top_20_pct_count],
        ).fetchone()[0] or 0.0

        total_revenue = conn.execute("SELECT SUM(monetary) FROM customer_features").fetchone()[0] or 1.0
        share_pct = round(top_revenue / total_revenue * 100, 1)

        insights.append({
            "type":        "pareto",
            "title":       "帕累托集中效應",
            "description": f"前 20%（{top_20_pct_count:,} 位）客戶貢獻了 {share_pct}% 的總收入",
            "value":       f"{share_pct}%",
            "icon":        "Users",
        })
    except Exception as e:
        log.warning(f"Pareto insight failed: {e}")

    # ── 2. 最高峰月份 ─────────────────────────────────────────────────────────
    try:
        row = conn.execute(
            """
            SELECT STRFTIME(date, '%Y-%m'), SUM(revenue)
            FROM daily_sales
            GROUP BY 1 ORDER BY 2 DESC LIMIT 1
            """
        ).fetchone()
        if row:
            peak_month, peak_rev = row
            insights.append({
                "type":        "peak_month",
                "title":       "全年收入高峰",
                "description": f"{peak_month} 為全年最高銷售月，聖誕備貨旺季效應明顯",
                "value":       f"£{peak_rev:,.0f}",
                "icon":        "TrendingUp",
            })
    except Exception as e:
        log.warning(f"Peak month insight failed: {e}")

    # ── 3. Champion 客戶 vs 全體平均消費倍數 ─────────────────────────────────
    try:
        row = conn.execute(
            """
            SELECT
                AVG(CASE WHEN segment = 'Champions' THEN monetary END) AS champ_avg,
                AVG(monetary) AS overall_avg
            FROM customer_features
            """
        ).fetchone()
        if row and row[0] and row[1]:
            champ_avg, overall_avg = float(row[0]), float(row[1])
            multiplier = round(champ_avg / overall_avg, 1)
            insights.append({
                "type":        "champions",
                "title":       "頂級客戶消費力",
                "description": f"Champions 平均消費是全體的 {multiplier}×（£{champ_avg:,.0f} vs £{overall_avg:,.0f}）",
                "value":       f"{multiplier}×",
                "icon":        "Crown",
            })
    except Exception as e:
        log.warning(f"Champions insight failed: {e}")

    # ── 4. 最強 MBA 規則 ─────────────────────────────────────────────────────
    try:
        row = conn.execute(
            """
            SELECT r.antecedents, p1.description, r.consequents, p2.description, r.lift
            FROM mba_rules r
            LEFT JOIN products p1 ON r.antecedents = p1.stock_code
            LEFT JOIN products p2 ON r.consequents = p2.stock_code
            ORDER BY r.lift DESC LIMIT 1
            """
        ).fetchone()
        if row:
            ant, ant_name, con, con_name, lift = row
            ant_label = ant_name if ant_name else ant
            con_label = con_name if con_name else con
            insights.append({
                "type":        "top_rule",
                "title":       "最強商品配對關係",
                "description": f"購買「{ant_label[:30]}」後購入「{con_label[:30]}」的機率高出隨機 {lift:.0f} 倍",
                "value":       f"Lift {lift:.1f}×",
                "icon":        "ShoppingCart",
            })
    except Exception as e:
        log.warning(f"Top rule insight failed: {e}")

    # ── 5. At Risk 客群潛在回購價值 ──────────────────────────────────────────
    try:
        row = conn.execute(
            """
            SELECT COUNT(*), ROUND(AVG(monetary), 0)
            FROM customer_features
            WHERE segment = 'At Risk'
            """
        ).fetchone()
        if row and row[0]:
            count, avg_m = int(row[0]), float(row[1])
            potential = count * avg_m
            insights.append({
                "type":        "at_risk",
                "title":       "流失風險客群潛力",
                "description": f"{count:,} 位 At Risk 客戶若成功挽回，可釋放 £{potential:,.0f} 潛在收入",
                "value":       f"£{potential:,.0f}",
                "icon":        "AlertTriangle",
            })
    except Exception as e:
        log.warning(f"At risk insight failed: {e}")

    log.info(f"Generated {len(insights)} business insights")
    return insights
