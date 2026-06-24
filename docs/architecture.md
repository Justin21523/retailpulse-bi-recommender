# Architecture

## System Overview

RetailPulse is a single-machine data product with three runtime components:

```
┌─────────────────────────────────────────────────────────┐
│  ETL Pipeline (one-shot, make etl)                      │
│  CSV → clean → DuckDB → features → models               │
└───────────────────┬─────────────────────────────────────┘
                    │ writes
                    ▼
┌─────────────────────────────────────────────────────────┐
│  DuckDB File: data/retailpulse.duckdb                   │
│  8 tables (7 required + mba_rules)                      │
└───────────┬────────────────────┬────────────────────────┘
            │ reads (read-only)  │ reads (read-only)
            ▼                    ▼
┌──────────────────┐   ┌────────────────────────────────┐
│  FastAPI API     │   │  Streamlit Dashboard            │
│  Port 8000       │   │  Port 8501                     │
│  6 endpoints     │   │  5 pages                       │
└──────────────────┘   └────────────────────────────────┘
```

## Component Details

### ETL Pipeline (`src/ingestion/loader.py`)

The main orchestrator runs once at `make etl`. It is **idempotent** — each run drops and recreates all tables.

```
load_raw() → clean_transactions() → create_all_tables()
  ├── build_customers_table()
  ├── build_products_table()
  ├── build_invoices_table()
  ├── build_invoice_items_table()
  ├── build_daily_sales_table()
  ├── compute_rfm() + score_rfm() → segment_customers() → save_customer_features()
  ├── compute_product_features() → save_product_features()
  └── build_basket_matrix() → run_apriori() → save_rules()
```

### DuckDB Warehouse

DuckDB operates as a file-based analytical database at `data/retailpulse.duckdb`.

- **ETL writes**: single-writer connection, closed before API starts
- **API reads**: one read-only connection per request (FastAPI route)
- **Streamlit reads**: one read-only connection per page render
- No concurrent writes — DuckDB is not a multi-writer server

### FastAPI Backend (`src/api/`)

Each request opens a fresh read-only DuckDB connection and closes it in `finally`. No connection pooling needed at this scale.

Router structure:
```
api/main.py
  ├── routes/health.py      GET /health
  ├── routes/metrics.py     GET /metrics/overview
  ├── routes/customers.py   GET /customers/{id}/rfm
  ├── routes/products.py    GET /products/top
  └── routes/recommendations.py
        ├── GET /recommendations/customer/{id}
        └── GET /recommendations/product/{code}
```

### RetailRecommender (`src/retrieval/recommender.py`)

3-tier recommendation cascade:
1. **Tier 1 — FBT**: Query `mba_rules` for products associated with what the customer already bought
2. **Tier 2 — Segment**: Top products from `product_features` for the customer's RFM segment
3. **Tier 3 — Popularity**: Global top-N from `product_features` (cold-start fallback)

### Streamlit App (`src/app/`)

Multi-page Streamlit app. Each page opens its own read-only DuckDB connection. Streamlit autodiscovers pages in `src/app/pages/` when the entry script is `src/app/streamlit_app.py`.

## Technology Choices

| Choice | Rationale |
|--------|-----------|
| DuckDB | Zero-config, file-based OLAP; excellent pandas integration; vectorized SQL |
| FastAPI | Async-capable, automatic OpenAPI docs, Pydantic v2 validation |
| Streamlit | Rapid BI dashboard prototyping with minimal boilerplate |
| K-Means | Simple, explainable; 4 segments is appropriate for a 50-customer demo |
| Apriori (mlxtend) | Standard MBA algorithm; interpretable rules; supports min_support/confidence/lift |
| uv | Fast Python package manager; lockfile support; PEP 621 compatible |

## Known Architectural Limitations

1. **Single-writer DuckDB**: ETL must fully complete before API starts. No incremental ingestion.
2. **No caching layer**: All API calls query DuckDB directly. At this scale (1,500 rows), latency is < 5ms. For production scale (millions of rows), add Redis or in-memory pre-computation.
3. **No authentication**: API is open. Add OAuth2/JWT for production use.
4. **Stateless Streamlit**: Each page reload re-queries DuckDB. Use `@st.cache_data` for expensive queries in production.
