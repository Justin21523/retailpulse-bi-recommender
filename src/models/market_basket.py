"""Market Basket Analysis via Apriori algorithm (mlxtend)."""
from __future__ import annotations

import duckdb
import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules

from utils.logger import get_logger

log = get_logger(__name__)


def build_basket_matrix(conn: duckdb.DuckDBPyConnection) -> pd.DataFrame:
    """Build a binary invoice × product transaction matrix.

    Args:
        conn: Open DuckDB connection with invoice_items table.

    Returns:
        Boolean DataFrame: rows = InvoiceNo, columns = StockCode.
    """
    sql = """
    SELECT invoice_no, stock_code, SUM(quantity) AS qty
    FROM invoice_items
    WHERE quantity > 0
    GROUP BY invoice_no, stock_code
    """
    df = conn.execute(sql).df()

    basket = df.pivot_table(
        index="invoice_no",
        columns="stock_code",
        values="qty",
        fill_value=0,
    )
    # Convert to boolean (bought / not bought)
    basket = basket.astype(bool)
    log.info(f"Basket matrix: {basket.shape[0]} invoices × {basket.shape[1]} products")
    return basket


def run_apriori(
    basket: pd.DataFrame,
    min_support: float = 0.02,
    min_confidence: float = 0.1,
) -> pd.DataFrame:
    """Run Apriori and generate association rules.

    Args:
        basket: Boolean transaction matrix from :func:`build_basket_matrix`.
        min_support: Minimum support threshold.
        min_confidence: Minimum confidence threshold.

    Returns:
        DataFrame of association rules sorted by lift (descending).
        Columns: antecedents, consequents, support, confidence, lift.
        Returns empty DataFrame if no rules found.
    """
    log.info(f"Running Apriori (min_support={min_support}, min_confidence={min_confidence})")
    freq_items = apriori(basket, min_support=min_support, use_colnames=True)

    if freq_items.empty:
        log.warning(f"No frequent itemsets found at min_support={min_support}")
        return pd.DataFrame()

    log.info(f"Found {len(freq_items)} frequent itemsets")

    rules = association_rules(freq_items, metric="confidence", min_threshold=min_confidence)
    if rules.empty:
        log.warning(f"No association rules at min_confidence={min_confidence}")
        return pd.DataFrame()

    # Stringify frozensets for storage
    rules["antecedents"] = rules["antecedents"].apply(lambda x: ", ".join(sorted(x)))
    rules["consequents"] = rules["consequents"].apply(lambda x: ", ".join(sorted(x)))

    result = rules[["antecedents", "consequents", "support", "confidence", "lift"]].copy()
    result = result.sort_values("lift", ascending=False).reset_index(drop=True)

    log.info(f"Generated {len(result)} association rules (max lift: {result['lift'].max():.2f})")
    return result


def save_rules(conn: duckdb.DuckDBPyConnection, rules: pd.DataFrame) -> None:
    """Persist association rules to the mba_rules table.

    Args:
        conn: Open DuckDB connection.
        rules: DataFrame from :func:`run_apriori`.
    """
    conn.execute("DELETE FROM mba_rules")
    conn.register("_rules", rules)
    conn.execute("INSERT INTO mba_rules SELECT * FROM _rules")
    log.info(f"mba_rules table: {len(rules)} rules saved")
