"""Recommendation demo dashboard page."""
from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[3]
for _p in [str(_ROOT), str(_ROOT / "src")]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

import duckdb
import pandas as pd
import streamlit as st

from retrieval.recommender import RetailRecommender
from utils.config import get_settings

st.set_page_config(page_title="Recommendations | RetailPulse", layout="wide")
st.header("✨ Product & Customer Recommendations")

try:
    settings = get_settings()
    conn = duckdb.connect(settings.duckdb_path, read_only=True)

    # Load available customers and products for dropdowns
    customers = conn.execute(
        "SELECT customer_id FROM customer_features ORDER BY customer_id"
    ).fetchdf()["customer_id"].tolist()

    products = conn.execute(
        "SELECT stock_code, description FROM product_features ORDER BY popularity_rank LIMIT 80"
    ).fetchdf()

    tab1, tab2 = st.tabs(["👤 Customer Recommendations", "📦 Product Similarity"])

    # ── Tab 1: Customer Recommendations ─────────────────────────────────────
    with tab1:
        st.subheader("Recommend Products for a Customer")

        if customers:
            selected_customer = st.selectbox("Select Customer ID", customers)
        else:
            selected_customer = st.text_input("Enter Customer ID", value="C1001")

        n_recs = st.slider("Number of recommendations", 3, 20, 10)

        if st.button("Get Customer Recommendations", type="primary"):
            rec = RetailRecommender(conn)
            results = rec.recommend_for_customer(selected_customer, n=n_recs)

            if results:
                df_recs = pd.DataFrame(results)
                display_cols = [c for c in ["stock_code", "description", "reason", "score", "lift"] if c in df_recs.columns]
                st.dataframe(df_recs[display_cols], use_container_width=True, hide_index=True)

                # Show customer RFM info
                rfm = conn.execute(
                    "SELECT segment, rfm_score, recency_days, frequency, monetary "
                    "FROM customer_features WHERE customer_id = ?",
                    [selected_customer],
                ).fetchone()
                if rfm:
                    st.info(
                        f"**{selected_customer}** — Segment: {rfm[0]} | "
                        f"RFM Score: {rfm[1]} | "
                        f"Recency: {rfm[2]}d | "
                        f"Orders: {rfm[3]} | "
                        f"Spend: £{rfm[4]:.0f}"
                    )
            else:
                st.warning("No recommendations found for this customer.")

    # ── Tab 2: Product Similarity ────────────────────────────────────────────
    with tab2:
        st.subheader("Find Similar Products (Frequently Bought Together)")

        if not products.empty:
            product_options = [
                f"{row['stock_code']} — {row['description']}"
                for _, row in products.iterrows()
            ]
            selected_product_str = st.selectbox("Select Product", product_options)
            selected_stock_code = selected_product_str.split(" — ")[0]
        else:
            selected_stock_code = st.text_input("Enter StockCode", value="P001")

        n_similar = st.slider("Number of similar products", 3, 20, 10, key="n_similar")

        if st.button("Find Similar Products", type="primary"):
            rec = RetailRecommender(conn)
            results = rec.recommend_for_product(selected_stock_code, n=n_similar)

            if results:
                df_recs = pd.DataFrame(results)
                display_cols = [c for c in ["stock_code", "description", "lift", "confidence", "support", "reason"] if c in df_recs.columns]
                st.dataframe(df_recs[display_cols], use_container_width=True, hide_index=True)
            else:
                st.warning("No similar products found. The product may not appear in any association rules.")

    conn.close()

except Exception as e:
    st.error(f"Error loading data: {e}")
    st.info("Run `make etl` first to populate the database.")
