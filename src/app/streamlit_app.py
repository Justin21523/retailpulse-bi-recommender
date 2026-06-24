"""RetailPulse Streamlit dashboard entry point."""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure src/ is importable when launched via `streamlit run`
_ROOT = Path(__file__).resolve().parents[2]
_SRC = _ROOT / "src"
for _p in [str(_ROOT), str(_SRC)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

import duckdb
import streamlit as st

st.set_page_config(
    page_title="RetailPulse BI",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("📊 RetailPulse BI + Recommendation Platform")
st.markdown(
    """
    > **RetailPulse** 是一個零售與電商資料產品，將交易資料轉換成可操作的商業洞察與推薦服務。

    Navigate using the sidebar to explore:
    - **Overview** — KPI cards & revenue trend
    - **RFM Segmentation** — customer value segments
    - **Cohort Retention** — monthly retention heatmap
    - **Market Basket** — association rule explorer
    - **Recommendations** — product and customer recommendations
    """
)

st.divider()

# Database status check
try:
    from utils.config import get_settings
    settings = get_settings()
    conn = duckdb.connect(settings.duckdb_path, read_only=True)
    n_invoices = conn.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
    n_customers = conn.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
    n_products = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    conn.close()

    col1, col2, col3 = st.columns(3)
    col1.metric("Invoices", f"{n_invoices:,}")
    col2.metric("Customers", f"{n_customers:,}")
    col3.metric("Products", f"{n_products:,}")
    st.success("Database loaded successfully. Use the sidebar to navigate.")

except Exception as e:
    st.warning(
        f"Database not ready. Run `make etl` first.\n\n```\nmake sample-data && make etl\n```"
    )
    st.caption(f"Error: {e}")

st.markdown("---")
st.caption(
    "Portfolio project | Online Retail UCI dataset (CC BY 4.0) | Synthetic demo data only"
)
