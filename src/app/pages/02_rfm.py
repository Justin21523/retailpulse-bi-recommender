"""RFM Segmentation dashboard page."""
from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[3]
for _p in [str(_ROOT), str(_ROOT / "src")]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

import duckdb
import plotly.express as px
import streamlit as st

from utils.config import get_settings

st.set_page_config(page_title="RFM Segmentation | RetailPulse", layout="wide")
st.header("👥 RFM Segmentation")

st.markdown(
    """
    Customers are segmented into 4 groups using K-Means clustering on
    **Recency** (days since last purchase), **Frequency** (number of orders),
    and **Monetary** (total spend).
    """
)

try:
    settings = get_settings()
    conn = duckdb.connect(settings.duckdb_path, read_only=True)

    df = conn.execute(
        "SELECT * FROM customer_features ORDER BY monetary DESC"
    ).fetchdf()
    conn.close()

    if df.empty:
        st.warning("No customer features found. Run `make etl` first.")
    else:
        # Scatter plot
        st.subheader("RFM Scatter Plot")
        fig = px.scatter(
            df,
            x="recency_days",
            y="frequency",
            color="segment",
            size="monetary",
            size_max=40,
            hover_data=["customer_id", "rfm_score", "monetary"],
            title="Customers: Recency vs Frequency (bubble size = Monetary value)",
            labels={
                "recency_days": "Recency (days since last purchase)",
                "frequency": "Frequency (number of orders)",
                "monetary": "Total Spend (£)",
            },
            color_discrete_map={
                "Champions": "#16a34a",
                "Loyal Customers": "#2563eb",
                "At Risk": "#f59e0b",
                "Lost": "#dc2626",
            },
        )
        st.plotly_chart(fig, use_container_width=True)

        st.divider()

        # Segment summary
        col_l, col_r = st.columns(2)

        with col_l:
            st.subheader("Segment Summary")
            summary = (
                df.groupby("segment")
                .agg(
                    customers=("customer_id", "count"),
                    avg_recency=("recency_days", "mean"),
                    avg_frequency=("frequency", "mean"),
                    avg_monetary=("monetary", "mean"),
                )
                .round(1)
                .reset_index()
            )
            st.dataframe(summary, use_container_width=True, hide_index=True)

        with col_r:
            st.subheader("Segment Distribution")
            fig_pie = px.pie(
                summary,
                values="customers",
                names="segment",
                title="Customer Count by Segment",
                color="segment",
                color_discrete_map={
                    "Champions": "#16a34a",
                    "Loyal Customers": "#2563eb",
                    "At Risk": "#f59e0b",
                    "Lost": "#dc2626",
                },
            )
            st.plotly_chart(fig_pie, use_container_width=True)

        st.divider()
        st.subheader("Customer Details")
        segment_filter = st.selectbox(
            "Filter by segment", ["All"] + sorted(df["segment"].unique().tolist())
        )
        display_df = df if segment_filter == "All" else df[df["segment"] == segment_filter]
        st.dataframe(
            display_df[["customer_id", "segment", "rfm_score", "recency_days", "frequency", "monetary"]],
            use_container_width=True,
            hide_index=True,
        )

except Exception as e:
    st.error(f"Error loading data: {e}")
    st.info("Run `make etl` first to populate the database.")
