"""Script to train tree-based churn models (Decision Tree / Random Forest / GBT).

Usage:
    PYTHONPATH=src uv run python src/scripts/train_tree.py

Or via Makefile:
    make train-tree
"""
import duckdb
import sys

sys.path.insert(0, "src")

from models.tree_models import ChurnTreeEnsemble
from utils.config import get_settings

conn = duckdb.connect(get_settings().duckdb_path)
result = ChurnTreeEnsemble.train(conn)
print("Done:", result)
conn.close()
