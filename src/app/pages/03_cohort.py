"""Cohort Retention dashboard page."""
from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[3]
for _p in [str(_ROOT), str(_ROOT / "src")]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

import duckdb
import numpy as np
import plotly.graph_objects as go
import streamlit as st

from features.cohort import compute_cohort_matrix
from utils.config import get_settings

st.set_page_config(page_title="Cohort Retention | RetailPulse", layout="wide")
st.header("🔄 Cohort Retention Analysis")

st.markdown(
    """
    Each row is a **cohort** — the group of customers who made their first purchase
    in a given month. Columns show what percentage of that cohort returned in
    subsequent months (Month 0 = acquisition month, always 100%).
    """
)

try:
    settings = get_settings()
    conn = duckdb.connect(settings.duckdb_path, read_only=True)

    matrix = compute_cohort_matrix(conn)
    conn.close()

    if matrix.empty:
        st.warning("No cohort data available. Run `make etl` first.")
    else:
        z = matrix.values
        x = list(matrix.columns)
        y = list(matrix.index)

        # Replace 0 with NaN for display (no purchase that period)
        z_display = np.where(z == 0, np.nan, z)

        fig = go.Figure(
            data=go.Heatmap(
                z=z_display,
                x=x,
                y=y,
                colorscale="RdYlGn",
                zmin=0,
                zmax=100,
                text=[
                    [f"{v:.0f}%" if not np.isnan(v) else "" for v in row]
                    for row in z_display
                ],
                texttemplate="%{text}",
                textfont={"size": 11},
                hoverongaps=False,
            )
        )
        fig.update_layout(
            title="Monthly Cohort Retention (%)",
            xaxis_title="Period",
            yaxis_title="Cohort (First Purchase Month)",
            height=max(350, 60 * len(y) + 100),
        )
        st.plotly_chart(fig, use_container_width=True)

        st.subheader("Retention Table (%)")
        st.dataframe(matrix.round(1), use_container_width=True)

except Exception as e:
    st.error(f"Error loading data: {e}")
    st.info("Run `make etl` first to populate the database.")
