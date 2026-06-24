# Model Card

## Model 1: RFM K-Means Segmentation

| Field | Value |
|-------|-------|
| Task | Customer segmentation (unsupervised) |
| Algorithm | K-Means Clustering |
| Library | scikit-learn |
| File | `src/models/rfm_segmentation.py` |

### Input Features

| Feature | Description | Preprocessing |
|---------|-------------|---------------|
| recency_days | Days since last purchase | StandardScaler |
| frequency | Number of distinct invoices | StandardScaler |
| monetary | Total spend in GBP | StandardScaler |

### Hyperparameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| n_clusters | 4 | Champions / Loyal / At Risk / Lost |
| random_state | 42 | Deterministic runs |
| n_init | 10 | Standard recommendation to avoid local minima |

### Segment Labels

Labels are assigned dynamically by ranking cluster centroids (after inverse-transform to original scale) on a composite score: `score = frequency + monetary_normalized - recency_days_normalized`. This ensures "Champions" always maps to the cluster with the best customers, regardless of random K-Means cluster ID assignment.

| Segment | Typical Profile |
|---------|----------------|
| Champions | Low recency, high frequency, high spend |
| Loyal Customers | Medium recency, above-average frequency |
| At Risk | Moderate recency, declining engagement |
| Lost | High recency (long absence), low spend |

### Limitations

- Only 3 features; does not capture product category preferences, seasonality, or browsing behavior
- With 50 synthetic customers, clusters are illustrative — run on real UCI data (25,000 customers) for meaningful segments
- No hyperparameter search for k (assumed 4); Elbow method or Silhouette score not implemented

---

## Model 2: Apriori Market Basket Analysis

| Field | Value |
|-------|-------|
| Task | Association rule mining |
| Algorithm | Apriori |
| Library | mlxtend |
| File | `src/models/market_basket.py` |

### Input

Binary transaction matrix: rows = InvoiceNo, columns = StockCode, values = True/False (whether the product was purchased).

### Parameters

| Parameter | Default | Notes |
|-----------|---------|-------|
| min_support | 0.02 | 2% of transactions must contain the itemset |
| min_confidence | 0.10 | At least 10% chance of purchasing B given A |
| lift_filter | > 1.0 | Positive association only |

### Output (stored in `mba_rules` table)

| Column | Description |
|--------|-------------|
| antecedents | Single product code (if-part) |
| consequents | Single product code (then-part) |
| support | Fraction of transactions containing both |
| confidence | P(consequents | antecedents) |
| lift | How much more likely vs. independent purchases |

### Limitations

- Only 1-item → 1-item rules stored (larger itemsets are computed but simplified for storage)
- Small dataset (300 invoices, 80 products) produces fewer rules than production data
- No temporal rules — seasonal co-purchase patterns not captured
- Pruning by min_support can miss rare but highly confident associations

---

## Recommendation Cascade

| Tier | Strategy | Source | Reason Field |
|------|----------|--------|-------------|
| 1 | Frequently Bought Together (FBT) | `mba_rules` | `"frequently_bought_together"` |
| 2 | Segment-based popularity | `product_features` by segment | `"segment:<name>"` |
| 3 | Global popularity fallback | `product_features` | `"popularity"` |

### Cold-Start Handling

- **New customer** (no purchase history): Skip Tier 1 and 2, return Tier 3 popularity
- **Known customer, no rules**: Skip Tier 1, use Tier 2 → Tier 3
- **Unknown product** (not in `mba_rules`): Return popularity fallback

### Known Biases

- Popularity bias: Tier 3 amplifies already-popular products
- No diversity mechanism — recommendations can cluster around the same product category
- Segment-based Tier 2 is currently identical to Tier 3 (product_features not filtered by segment purchases); this is noted as a future improvement
