"""DuckDB table DDL for the RetailPulse warehouse."""
from __future__ import annotations

import duckdb

CREATE_CUSTOMERS = """
CREATE TABLE IF NOT EXISTS customers (
    customer_id     VARCHAR PRIMARY KEY,
    country         VARCHAR,
    first_purchase  DATE,
    last_purchase   DATE,
    total_orders    INTEGER,
    total_spend     DOUBLE
)
"""

CREATE_PRODUCTS = """
CREATE TABLE IF NOT EXISTS products (
    stock_code      VARCHAR PRIMARY KEY,
    description     VARCHAR,
    avg_price       DOUBLE,
    total_sold      INTEGER,
    total_revenue   DOUBLE
)
"""

CREATE_INVOICES = """
CREATE TABLE IF NOT EXISTS invoices (
    invoice_no      VARCHAR PRIMARY KEY,
    customer_id     VARCHAR,
    invoice_date    TIMESTAMP,
    country         VARCHAR,
    total_amount    DOUBLE,
    item_count      INTEGER
)
"""

CREATE_INVOICE_ITEMS = """
CREATE TABLE IF NOT EXISTS invoice_items (
    id              INTEGER,
    invoice_no      VARCHAR,
    stock_code      VARCHAR,
    quantity        INTEGER,
    unit_price      DOUBLE,
    line_total      DOUBLE
)
"""

CREATE_DAILY_SALES = """
CREATE TABLE IF NOT EXISTS daily_sales (
    date                DATE PRIMARY KEY,
    revenue             DOUBLE,
    orders              INTEGER,
    unique_customers    INTEGER,
    units_sold          INTEGER
)
"""

CREATE_CUSTOMER_FEATURES = """
CREATE TABLE IF NOT EXISTS customer_features (
    customer_id     VARCHAR PRIMARY KEY,
    recency_days    INTEGER,
    frequency       INTEGER,
    monetary        DOUBLE,
    r_score         INTEGER,
    f_score         INTEGER,
    m_score         INTEGER,
    rfm_score       VARCHAR,
    segment         VARCHAR
)
"""

CREATE_PRODUCT_FEATURES = """
CREATE TABLE IF NOT EXISTS product_features (
    stock_code      VARCHAR PRIMARY KEY,
    description     VARCHAR,
    total_revenue   DOUBLE,
    total_quantity  INTEGER,
    order_count     INTEGER,
    avg_price       DOUBLE,
    popularity_rank INTEGER
)
"""

CREATE_MBA_RULES = """
CREATE TABLE IF NOT EXISTS mba_rules (
    antecedents     VARCHAR,
    consequents     VARCHAR,
    support         DOUBLE,
    confidence      DOUBLE,
    lift            DOUBLE
)
"""

# ── Phase 4 tables ────────────────────────────────────────────────────────────

CREATE_ITEM_EMBEDDINGS = """
CREATE TABLE IF NOT EXISTS item_embeddings (
    stock_code  VARCHAR PRIMARY KEY,
    embedding   FLOAT[64],
    trained_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
"""

CREATE_PRODUCT_EMBEDDINGS = """
CREATE TABLE IF NOT EXISTS product_embeddings (
    stock_code  VARCHAR PRIMARY KEY,
    embedding   FLOAT[384],
    model_name  VARCHAR DEFAULT 'all-MiniLM-L6-v2',
    trained_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
"""

CREATE_SALES_FORECASTS = """
CREATE TABLE IF NOT EXISTS sales_forecasts (
    date                DATE,
    predicted_revenue   DOUBLE,
    lower_ci            DOUBLE,
    upper_ci            DOUBLE,
    model_name          VARCHAR,
    horizon_days        INTEGER,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (date, model_name)
)
"""

CREATE_CF_RECOMMENDATIONS = """
CREATE TABLE IF NOT EXISTS cf_recommendations (
    customer_id VARCHAR PRIMARY KEY,
    stock_codes VARCHAR,
    scores      VARCHAR,
    model_name  VARCHAR DEFAULT 'als',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
"""

CREATE_AB_EXPERIMENTS = """
CREATE TABLE IF NOT EXISTS ab_experiments (
    experiment_id   VARCHAR PRIMARY KEY,
    name            VARCHAR NOT NULL,
    description     VARCHAR,
    variants        VARCHAR,
    started_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at        TIMESTAMP,
    status          VARCHAR DEFAULT 'active'
)
"""

CREATE_AB_EVENTS = """
CREATE TABLE IF NOT EXISTS ab_events (
    event_id        VARCHAR PRIMARY KEY,
    experiment_id   VARCHAR NOT NULL,
    variant         VARCHAR NOT NULL,
    user_id         VARCHAR,
    event_type      VARCHAR,
    value           DOUBLE DEFAULT 1.0,
    recorded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
"""

CREATE_AB_RESULTS = """
CREATE TABLE IF NOT EXISTS ab_results (
    result_id           VARCHAR PRIMARY KEY,
    experiment_id       VARCHAR NOT NULL,
    metric              VARCHAR,
    control_variant     VARCHAR,
    treatment_variant   VARCHAR,
    control_rate        DOUBLE,
    treatment_rate      DOUBLE,
    p_value             DOUBLE,
    effect_size         DOUBLE,
    significant         BOOLEAN,
    confidence_level    DOUBLE DEFAULT 0.95,
    computed_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
"""

CREATE_PRODUCT_CLUSTERS_NLP = """
CREATE TABLE IF NOT EXISTS product_clusters_nlp (
    stock_code      VARCHAR PRIMARY KEY,
    cluster_id      INTEGER,
    cluster_label   VARCHAR,
    top_keywords    VARCHAR,
    lsa_score       DOUBLE
)
"""

CREATE_MODEL_REGISTRY = """
CREATE TABLE IF NOT EXISTS model_registry (
    model_id        VARCHAR PRIMARY KEY,
    model_name      VARCHAR NOT NULL,
    model_type      VARCHAR,
    metrics         VARCHAR,
    artifact_path   VARCHAR,
    trained_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description     VARCHAR
)
"""

_ALL_DDL = [
    CREATE_CUSTOMERS,
    CREATE_PRODUCTS,
    CREATE_INVOICES,
    CREATE_INVOICE_ITEMS,
    CREATE_DAILY_SALES,
    CREATE_CUSTOMER_FEATURES,
    CREATE_PRODUCT_FEATURES,
    CREATE_MBA_RULES,
    # Phase 4
    CREATE_ITEM_EMBEDDINGS,
    CREATE_PRODUCT_EMBEDDINGS,
    CREATE_SALES_FORECASTS,
    CREATE_CF_RECOMMENDATIONS,
    CREATE_AB_EXPERIMENTS,
    CREATE_AB_EVENTS,
    CREATE_AB_RESULTS,
    CREATE_PRODUCT_CLUSTERS_NLP,
    CREATE_MODEL_REGISTRY,
]


def create_all_tables(conn: duckdb.DuckDBPyConnection) -> None:
    """Create all warehouse tables if they do not exist."""
    for ddl in _ALL_DDL:
        conn.execute(ddl)
