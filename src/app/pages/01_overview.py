"""Overview KPI dashboard page."""
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

st.set_page_config(page_title="Overview | RetailPulse", layout="wide")
st.header("📈 Overview KPIs")

try:
    settings = get_settings()
    conn = duckdb.connect(settings.duckdb_path, read_only=True)

    # KPI row
    row = conn.execute("""
        SELECT
            COALESCE(SUM(total_amount), 0)       AS total_revenue,
            COUNT(*)                              AS total_orders,
            COALESCE(AVG(total_amount), 0)        AS aov,
            COUNT(DISTINCT customer_id)           AS unique_customers
        FROM invoices
    """).fetchone()

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Revenue", f"£{row[0]:,.0f}")
    c2.metric("Total Orders", f"{row[1]:,}")
    c3.metric("Avg Order Value", f"£{row[2]:.2f}")
    c4.metric("Unique Customers", f"{row[3]:,}")

    st.divider()

    # Revenue trend
    df_daily = conn.execute(
        "SELECT date, revenue FROM daily_sales ORDER BY date"
    ).fetchdf()

    if not df_daily.empty:
        fig = px.line(
            df_daily,
            x="date",
            y="revenue",
            title="Daily Revenue Trend",
            labels={"date": "Date", "revenue": "Revenue (£)"},
        )
        fig.update_traces(line_color="#2563EB")
        st.plotly_chart(fig, use_container_width=True)

    st.divider()

    # Top countries
    col_l, col_r = st.columns(2)

    with col_l:
        st.subheader("Top Countries by Revenue")
        df_countries = conn.execute("""
            SELECT country, SUM(total_amount) AS revenue, COUNT(*) AS orders
            FROM invoices
            GROUP BY country
            ORDER BY revenue DESC
            LIMIT 10
        """).fetchdf()
        fig_c = px.bar(
            df_countries,
            x="revenue",
            y="country",
            orientation="h",
            title="Revenue by Country",
            labels={"revenue": "Revenue (£)", "country": "Country"},
        )
        fig_c.update_layout(yaxis={"categoryorder": "total ascending"})
        st.plotly_chart(fig_c, use_container_width=True)

    with col_r:
        st.subheader("Monthly Revenue")
        df_monthly = conn.execute("""
            SELECT
                DATE_TRUNC('month', date) AS month,
                SUM(revenue) AS revenue
            FROM daily_sales
            GROUP BY month
            ORDER BY month
        """).fetchdf()
        fig_m = px.bar(
            df_monthly,
            x="month",
            y="revenue",
            title="Monthly Revenue",
            labels={"month": "Month", "revenue": "Revenue (£)"},
        )
        st.plotly_chart(fig_m, use_container_width=True)

    conn.close()

except Exception as e:
    st.error(f"Error loading data: {e}")
    st.info("Run `make etl` first to populate the database.")
