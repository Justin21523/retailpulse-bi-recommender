"""Keyword extraction and product taxonomy utilities.

從商品描述中提取有用的結構性特徵（顏色、材質、用途）。
可結合 ProductClustering 的 TF-IDF 結果使用。
"""
from __future__ import annotations

import re

import pandas as pd

# 常見零售商品顏色詞彙
_COLORS = {
    "red", "blue", "green", "pink", "black", "white", "yellow",
    "orange", "purple", "grey", "gray", "brown", "cream", "gold",
    "silver", "navy", "lime", "ivory", "turquoise", "vintage",
}

# 常見商品材質/類型詞
_MATERIALS = {
    "wood", "wooden", "metal", "glass", "ceramic", "plastic",
    "fabric", "cotton", "paper", "card", "cardboard", "tin", "wicker",
    "aluminium", "aluminum", "canvas",
}

# 常見商品功能分類詞
_CATEGORIES = {
    "holder", "bag", "box", "set", "kit", "stand", "frame",
    "candle", "light", "lamp", "clock", "mug", "cup", "plate",
    "bowl", "vase", "cushion", "blanket", "towel", "mirror",
    "handbag", "purse", "ornament", "decoration", "gift",
}


def extract_features(description: str) -> dict[str, str]:
    """Extract structured attributes from a product description string.

    Args:
        description: Raw product description (e.g. 'HAND WARMER RED POLKA DOT').

    Returns:
        Dict with keys: color, material, category (empty string if not found).
    """
    words = set(description.lower().split())
    return {
        "color":    ", ".join(sorted(words & _COLORS)) or "",
        "material": ", ".join(sorted(words & _MATERIALS)) or "",
        "category": ", ".join(sorted(words & _CATEGORIES)) or "",
    }


def enrich_products(df: pd.DataFrame) -> pd.DataFrame:
    """Add color / material / category columns to a products DataFrame.

    Args:
        df: DataFrame with 'stock_code' and 'description' columns.

    Returns:
        Same DataFrame with three new columns appended.
    """
    features = df["description"].fillna("").apply(extract_features)
    df = df.copy()
    df["color"]    = features.apply(lambda x: x["color"])
    df["material"] = features.apply(lambda x: x["material"])
    df["category"] = features.apply(lambda x: x["category"])
    return df


def top_terms_per_cluster(
    descriptions: list[str],
    cluster_ids: list[int],
    top_n: int = 5,
) -> dict[int, list[str]]:
    """Return the top_n most frequent words per cluster.

    Simple word-frequency approach (no TF-IDF) for lightweight cluster labeling.

    Args:
        descriptions: List of product descriptions.
        cluster_ids: Corresponding cluster label for each description.
        top_n: Number of terms to return per cluster.

    Returns:
        Dict mapping cluster_id → list of top terms.
    """
    from collections import Counter
    _stop = {"and", "or", "of", "the", "a", "an", "with", "for", "to", "in"}
    cluster_words: dict[int, list[str]] = {}
    for desc, cid in zip(descriptions, cluster_ids):
        words = [w.lower() for w in re.split(r"\W+", desc) if len(w) > 2 and w.lower() not in _stop]
        cluster_words.setdefault(cid, []).extend(words)
    return {cid: [w for w, _ in Counter(words).most_common(top_n)] for cid, words in cluster_words.items()}
