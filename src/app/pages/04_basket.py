"""Market Basket Analysis dashboard page."""
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

st.set_page_config(page_title="Market Basket | RetailPulse", layout="wide")
st.header("🛒 Market Basket Analysis")

st.markdown(
    """
    Association rules discovered via the **Apriori algorithm**.
    - **Support**: fraction of transactions containing both items
    - **Confidence**: P(consequent | antecedent)
    - **Lift**: how much more likely items are bought together vs. independently
      (lift > 1 = positive association)
    """
)

try:
    settings = get_settings()
    conn = duckdb.connect(settings.duckdb_path, read_only=True)

    df = conn.execute(
        "SELECT * FROM mba_rules ORDER BY lift DESC"
    ).fetchdf()
    conn.close()

    if df.empty:
        st.warning(
            "No association rules found. The dataset may be too small for the current "
            "min_support threshold. Run `make etl` with lower min_support in settings."
        )
    else:
        # Filters
        col_l, col_r, col_m = st.columns(3)
        min_lift = col_l.slider(
            "Min Lift", min_value=1.0, max_value=float(df["lift"].max()), value=1.0, step=0.1
        )
        min_conf = col_r.slider(
            "Min Confidence", min_value=0.0, max_value=1.0, value=0.1, step=0.05
        )
        top_n = col_m.number_input("Show top N rules", min_value=5, max_value=200, value=50)

        filtered = df[(df["lift"] >= min_lift) & (df["confidence"] >= min_conf)].head(int(top_n))
        st.caption(f"Showing {len(filtered)} of {len(df)} total rules")

        # Scatter: support vs confidence, colored by lift
        fig = px.scatter(
            filtered,
            x="support",
            y="confidence",
            color="lift",
            size="lift",
            size_max=20,
            hover_data=["antecedents", "consequents"],
            title="Association Rules: Support vs Confidence (color = Lift)",
            color_continuous_scale="Viridis",
            labels={"support": "Support", "confidence": "Confidence", "lift": "Lift"},
        )
        st.plotly_chart(fig, use_container_width=True)

        st.subheader("Top Rules")
        st.dataframe(
            filtered[["antecedents", "consequents", "support", "confidence", "lift"]].round(4),
            use_container_width=True,
            hide_index=True,
        )

except Exception as e:
    st.error(f"Error loading data: {e}")
    st.info("Run `make etl` first to populate the database.")
