# Demo Script (2 Minutes)

This is a structured walkthrough for a recruiter, hiring manager, or technical interviewer.

---

## Before the Demo

```bash
make install
make sample-data
make etl
# In one terminal:
make api
# In another terminal:
make app
```

Open http://localhost:8501 in your browser.

---

## Demo Walkthrough (2 min)

### 0:00 — Context (15 sec)

> "This is RetailPulse — a retail BI and recommendation platform. It takes raw transaction data, loads it into a DuckDB analytical warehouse, and surfaces business insights through a FastAPI backend and this Streamlit dashboard. Let me walk you through the full stack."

### 0:15 — Overview Page (30 sec)

Navigate to **Overview** in the sidebar.

> "The overview page shows our top-line KPIs — total revenue, average order value, active customers. Below that is a daily revenue trend. You can see seasonal patterns in the data. Monthly revenue breakdown is on the right. All of this is queried live from DuckDB with sub-millisecond latency."

Point to the KPI cards, then the line chart.

### 0:45 — RFM Segmentation (30 sec)

Navigate to **RFM Segmentation**.

> "We segment customers into four groups using K-Means clustering on Recency, Frequency, and Monetary value. Each bubble here is a customer — position is recency vs frequency, bubble size is their total spend, color is their segment. Champions are green — recent, frequent, high-spend buyers. The red dots on the far right are lost customers who haven't bought in a long time."

Point to the scatter plot, then the segment summary table.

### 1:15 — Market Basket Analysis (20 sec)

Navigate to **Market Basket**.

> "We use the Apriori algorithm to find products that get bought together. These are association rules — the lift column tells us how much more likely product B is bought with product A versus independently. You can filter by minimum lift or confidence with these sliders."

Adjust the lift slider to show filtering.

### 1:35 — Recommendations (20 sec)

Navigate to **Recommendations**.

> "The recommendation engine uses a 3-tier cascade — first it looks for products the customer buys together based on MBA rules, then segment-level popularity, then a global popularity fallback. Let me pick a customer and show you the output."

Select a customer from the dropdown, click "Get Customer Recommendations".

> "Each recommendation has a reason field telling you which strategy fired — so you can audit the system's logic."

### 1:55 — API Docs (5 sec)

> "The same data is exposed via FastAPI at localhost:8000/docs — fully documented OpenAPI spec, ready to integrate with any frontend or BI tool."

---

## Key Technical Points to Highlight

1. **"The ETL is idempotent"** — `make etl` can be re-run without corrupting data
2. **"No mock data in tests"** — tests use an in-memory DuckDB populated from fixture data
3. **"The cluster labels are dynamic"** — K-Means cluster IDs are not hard-coded; the system ranks centroids to assign "Champions" to the best cluster every time
4. **"3-tier cascade prevents cold-start silence"** — even a brand-new customer gets recommendations (popularity fallback)

## Questions to Expect

- **"What would you change for production?"** → Incremental ETL, Redis caching, proper temporal split for evaluation, auth on the API, PostgreSQL for concurrent writes
- **"Why DuckDB instead of Postgres?"** → Zero config, excellent pandas integration, column-oriented so aggregations are 10–100x faster for analytics; add Postgres when you need concurrent writes
- **"How would you scale the recommender?"** → Add collaborative filtering (ALS/SVD), embed products with sentence-transformers for semantic similarity, serve recommendations from pre-computed Redis cache
